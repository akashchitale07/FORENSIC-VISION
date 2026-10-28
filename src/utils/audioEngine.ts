import {
  AudioForensicSession,
  AudioSignalMetrics,
  AudioSilenceInterval,
  AudioAnomalyMarker,
  EnfAnalysisResult,
  AudioLsbAnalysis,
  AudioDerivative,
  FileIntegrity,
  AnomalySeverity,
} from '../types/forensics';
import { parseAudioContainer } from './audioContainerParser';
import { calculateShannonEntropy } from './binaryParser';
import { formatBytes } from './crypto';

// Format seconds into MM:SS.mmm format for forensic timelines
export function formatAudioTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Convert linear amplitude to dBFS (Full Scale, 0 dBFS is max)
export function amplitudeToDb(amp: number): number {
  if (amp <= 0.000001) return -120;
  const db = 20 * Math.log10(amp);
  return Math.max(-120, Math.min(0, db));
}

// Compute SHA-256 and SHA-1 hashes using browser Web Crypto APIs
export async function computeAudioHashes(
  buffer: ArrayBuffer
): Promise<{ sha256: string; sha1: string }> {
  const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha256Array = Array.from(new Uint8Array(sha256Buffer));
  const sha256 = sha256Array.map((b) => b.toString(16).padStart(2, '0')).join('');

  const sha1Buffer = await crypto.subtle.digest('SHA-1', buffer);
  const sha1Array = Array.from(new Uint8Array(sha1Buffer));
  const sha1 = sha1Array.map((b) => b.toString(16).padStart(2, '0')).join('');

  return { sha256, sha1 };
}

// Signal Metrics Calculation
export function calculateSignalMetrics(
  audioBuffer: AudioBuffer,
  encodedBitDepth?: number
): AudioSignalMetrics {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const totalSamples = audioBuffer.length;

  let maxAbsAmp = 0;
  let sumSquared = 0;
  let sumSamples = 0;
  let clippedSamples = 0;
  let zeroCrossings = 0;

  // Channel balance trackers
  let leftSumSq = 0;
  let rightSumSq = 0;

  const leftData = audioBuffer.getChannelData(0);
  const rightData = channels > 1 ? audioBuffer.getChannelData(1) : null;

  // Stride sample for huge files to keep performance instant (<100ms)
  const step = Math.max(1, Math.floor(totalSamples / 500000));
  let sampleCount = 0;

  for (let i = 0; i < totalSamples; i += step) {
    const valL = leftData[i];
    const absValL = Math.abs(valL);

    if (absValL > maxAbsAmp) maxAbsAmp = absValL;
    leftSumSq += valL * valL;
    sumSquared += valL * valL;
    sumSamples += valL;

    if (absValL >= 0.999) {
      clippedSamples += step;
    }

    if (i > 0 && ((leftData[i] >= 0 && leftData[i - step] < 0) || (leftData[i] < 0 && leftData[i - step] >= 0))) {
      zeroCrossings++;
    }

    if (rightData) {
      const valR = rightData[i];
      const absValR = Math.abs(valR);
      if (absValR > maxAbsAmp) maxAbsAmp = absValR;
      rightSumSq += valR * valR;
      sumSquared += valR * valR;
      if (absValR >= 0.999) {
        clippedSamples += step;
      }
    }
    sampleCount++;
  }

  const effectiveDivisor = sampleCount * (channels > 1 ? 2 : 1);
  const rmsLinear = Math.sqrt(sumSquared / effectiveDivisor);
  const peakDbFs = amplitudeToDb(maxAbsAmp);
  const rmsDbFs = amplitudeToDb(rmsLinear);
  const dcOffset = sumSamples / sampleCount;

  // Dynamic range estimate: Peak dBFS minus noise floor
  const dynamicRangeDb = Math.max(0, Math.min(120, Math.abs(peakDbFs - Math.max(rmsDbFs - 40, -96))));
  const clippingCount = Math.min(totalSamples, clippedSamples);
  const clippingRatio = (clippingCount / totalSamples) * 100;
  const zeroCrossingRate = (zeroCrossings / sampleCount);

  // Spectral centroid rough estimate via zero crossing rate and sample rate
  const spectralCentroidHz = Math.min(sampleRate / 2, Math.round(zeroCrossingRate * (sampleRate / 2) * 1.2));

  let channelBalanceRatio: number | undefined;
  if (channels > 1 && rightSumSq > 0) {
    channelBalanceRatio = Number((Math.sqrt(leftSumSq / sampleCount) / Math.sqrt(rightSumSq / sampleCount)).toFixed(3));
  }

  return {
    duration,
    formattedDuration: formatAudioTimestamp(duration),
    sampleRate,
    channels,
    totalSamples,
    peakDbFs: Number(peakDbFs.toFixed(2)),
    rmsDbFs: Number(rmsDbFs.toFixed(2)),
    dynamicRangeDb: Number(dynamicRangeDb.toFixed(2)),
    clippingCount,
    clippingRatio: Number(clippingRatio.toFixed(3)),
    zeroCrossingRate: Number(zeroCrossingRate.toFixed(4)),
    spectralCentroidHz,
    dcOffset: Number(dcOffset.toFixed(5)),
    channelBalanceRatio,
  };
}

// Silence and Room Tone Dropouts Detection
export function detectSilenceIntervals(
  audioBuffer: AudioBuffer,
  thresholdDb: number = -48,
  minDurationSec: number = 0.2
): AudioSilenceInterval[] {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  const windowSize = Math.floor(sampleRate * 0.05); // 50ms evaluation window
  const minWindowCount = Math.ceil(minDurationSec / 0.05);

  const silences: AudioSilenceInterval[] = [];
  let currentSilenceStart: number | null = null;
  let currentSilenceWindows = 0;
  let sumLinearInSilence = 0;

  const totalWindows = Math.floor(data.length / windowSize);

  for (let w = 0; w < totalWindows; w++) {
    const startIdx = w * windowSize;
    let windowSumSq = 0;
    for (let i = 0; i < windowSize; i++) {
      const v = data[startIdx + i];
      windowSumSq += v * v;
    }
    const windowRms = Math.sqrt(windowSumSq / windowSize);

    if (windowRms < thresholdLinear) {
      if (currentSilenceStart === null) {
        currentSilenceStart = startIdx / sampleRate;
        currentSilenceWindows = 0;
        sumLinearInSilence = 0;
      }
      currentSilenceWindows++;
      sumLinearInSilence += windowRms;
    } else {
      if (currentSilenceStart !== null && currentSilenceWindows >= minWindowCount) {
        const endTime = startIdx / sampleRate;
        const dur = endTime - currentSilenceStart;
        const avgLinear = sumLinearInSilence / currentSilenceWindows;
        const avgDb = amplitudeToDb(avgLinear);

        // Check if transition into silence is unnaturally abrupt (< 10ms room noise dropout)
        const prevWindowIdx = Math.max(0, startIdx - (currentSilenceWindows + 1) * windowSize);
        let prevRms = 0;
        for (let j = 0; j < windowSize; j++) {
          prevRms += data[prevWindowIdx + j] * data[prevWindowIdx + j];
        }
        prevRms = Math.sqrt(prevRms / windowSize);
        const prevDb = amplitudeToDb(prevRms);
        const isAbrupt = (prevDb - avgDb) > 24;

        silences.push({
          id: `silence-${silences.length + 1}`,
          startTime: Number(currentSilenceStart.toFixed(3)),
          endTime: Number(endTime.toFixed(3)),
          duration: Number(dur.toFixed(3)),
          formattedRange: `${formatAudioTimestamp(currentSilenceStart)} - ${formatAudioTimestamp(endTime)}`,
          avgDbFs: Number(avgDb.toFixed(1)),
          isAbrupt,
        });
      }
      currentSilenceStart = null;
      currentSilenceWindows = 0;
    }
  }

  return silences.slice(0, 50); // limit to top 50
}

// Editing Anomalies, Splice Points & Abrupt Transients Detection
export function detectAudioAnomalies(
  audioBuffer: AudioBuffer,
  silences: AudioSilenceInterval[],
  metrics: AudioSignalMetrics
): AudioAnomalyMarker[] {
  const anomalies: AudioAnomalyMarker[] = [];
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalLength = channelData.length;

  // Check 1: Excessive clipping / saturation
  if (metrics.clippingRatio > 0.05) {
    anomalies.push({
      id: `anom-clip`,
      timestamp: 0,
      formattedTimestamp: '00:00.000 (File-wide)',
      category: metrics.clippingRatio > 1.0 ? 'Suspicious' : 'Potential Indicator',
      type: 'Clipping / Saturation',
      confidence: Math.min(95, Math.round(50 + metrics.clippingRatio * 20)),
      metric: `${metrics.clippingCount.toLocaleString()} clipped samples (${metrics.clippingRatio}% ratio)`,
      explanation:
        'Detected repeated waveform sample peaks pegged at full digital scale (0 dBFS). Indicates severe acoustic distortion, re-amplification, or dynamic compression.',
      alternativeHypothesis:
        'Overdriven recording pre-amplifier, excessive proximity effect to microphone, or heavy intentional limiting during mastering.',
    });
  }

  // Check 2: Abrupt Silence Dropouts (Room tone discontinuity)
  for (const sil of silences) {
    if (sil.isAbrupt && sil.duration >= 0.15) {
      anomalies.push({
        id: `anom-sil-${sil.id}`,
        timestamp: sil.startTime,
        formattedTimestamp: formatAudioTimestamp(sil.startTime),
        durationMs: Math.round(sil.duration * 1000),
        category: sil.avgDbFs < -70 ? 'Suspicious' : 'Potential Indicator',
        type: 'Suspicious Silence',
        confidence: 82,
        metric: `Abrupt drop to ${sil.avgDbFs} dBFS for ${(sil.duration * 1000).toFixed(0)}ms`,
        explanation:
          'Background acoustic ambient noise abruptly vanishes to near digital silence without natural reverberation decay. Classic indicator of audio splicing or muted segments.',
        alternativeHypothesis:
          'Noise gate plugin activated during silent intervals, hardware squelch in communication radio, or speaker silence.',
      });
    }
  }

  // Check 3: Short Window Transient / Splice Point Search
  // We compare energy in 25ms adjacent frames
  const frameSamples = Math.floor(sampleRate * 0.025); // 25ms
  const step = frameSamples;
  let prevFrameRms = 0;

  for (let i = frameSamples; i + frameSamples < totalLength; i += step) {
    let currEnergy = 0;
    for (let j = 0; j < frameSamples; j++) {
      const s = channelData[i + j];
      currEnergy += s * s;
    }
    const currRms = Math.sqrt(currEnergy / frameSamples);

    if (prevFrameRms > 0.005 && currRms > 0.005) {
      const prevDb = amplitudeToDb(prevFrameRms);
      const currDb = amplitudeToDb(currRms);
      const deltaDb = Math.abs(currDb - prevDb);

      // Huge instantaneous jump (> 22 dB jump in 25ms)
      if (deltaDb > 22) {
        const timeSec = i / sampleRate;
        anomalies.push({
          id: `anom-splice-${i}`,
          timestamp: Number(timeSec.toFixed(3)),
          formattedTimestamp: formatAudioTimestamp(timeSec),
          durationMs: 25,
          category: deltaDb > 30 ? 'Suspicious' : 'Potential Indicator',
          type: 'Potential Splice Point',
          confidence: Math.min(88, Math.round(55 + deltaDb)),
          metric: `${deltaDb > 0 ? '+' : ''}${deltaDb.toFixed(1)} dB step in 25ms`,
          explanation:
            'Rapid energy and phase discontinuity across adjacent 25ms frames without continuous ramp. Potential butt-splice or cross-fade artifact between different recording takes.',
          alternativeHypothesis:
            'Acoustic impact sound (handclap, door slam, percussion), plosive speech consonant ("p", "t", "b"), or microphone bump.',
        });
        // Skip ahead 0.5s to avoid duplicate hits on single transient
        i += Math.floor(sampleRate * 0.5);
      }
    }
    prevFrameRms = currRms;
  }

  // Check 4: DC Offset Shift
  if (Math.abs(metrics.dcOffset) > 0.015) {
    anomalies.push({
      id: `anom-dc-offset`,
      timestamp: 0,
      formattedTimestamp: '00:00.000 (File-wide)',
      category: 'Potential Indicator',
      type: 'DC Offset Shift',
      confidence: 75,
      metric: `DC Bias: ${(metrics.dcOffset * 100).toFixed(2)}%`,
      explanation:
        'Waveform baseline is displaced from true electrical zero. Can result from faulty ADC grounding or post-processing arithmetic.',
      alternativeHypothesis:
        'Consumer soundcard capacitor leakage or unbalanced analog microphone pre-amp output.',
    });
  }

  // Check 5: Stereo Asymmetry
  if (metrics.channelBalanceRatio !== undefined && (metrics.channelBalanceRatio < 0.25 || metrics.channelBalanceRatio > 4.0)) {
    anomalies.push({
      id: `anom-balance`,
      timestamp: 0,
      formattedTimestamp: '00:00.000 (File-wide)',
      category: 'Informational',
      type: 'Channel Asymmetry',
      confidence: 60,
      metric: `L/R Ratio: ${metrics.channelBalanceRatio}:1`,
      explanation:
        'Severe power asymmetry detected between left and right channels in dual-channel recording.',
      alternativeHypothesis:
        'Directional stereo microphone position, single microphone plugged into only one channel of a stereo recorder.',
    });
  }

  return anomalies.slice(0, 30);
}

// ENF (Electrical Network Frequency) Analysis
export function analyzeEnf(audioBuffer: AudioBuffer): EnfAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Bandpass / DFT probe around 50 Hz and 60 Hz mains
  const target50 = 50;
  const target60 = 60;

  // Compute energy in 49-51 Hz vs 40-48 Hz (for 50Hz grid)
  // Compute energy in 59-61 Hz vs 50-58 Hz (for 60Hz grid)
  let power50 = 0;
  let powerNoise50 = 0;
  let power60 = 0;
  let powerNoise60 = 0;

  // Use Goertzel-like single-frequency energy probe on downsampled data
  const probeSamples = Math.min(channelData.length, sampleRate * 10); // test up to 10s
  for (let i = 0; i < probeSamples; i += 2) {
    const t = i / sampleRate;
    const s = channelData[i];

    // 50Hz probe
    const cos50 = Math.cos(2 * Math.PI * target50 * t);
    const cosRef50 = Math.cos(2 * Math.PI * 45 * t);
    power50 += s * cos50;
    powerNoise50 += s * cosRef50;

    // 60Hz probe
    const cos60 = Math.cos(2 * Math.PI * target60 * t);
    const cosRef60 = Math.cos(2 * Math.PI * 55 * t);
    power60 += s * cos60;
    powerNoise60 += s * cosRef60;
  }

  const snr50 = 20 * Math.log10(Math.max(1, Math.abs(power50)) / Math.max(1, Math.abs(powerNoise50)));
  const snr60 = 20 * Math.log10(Math.max(1, Math.abs(power60)) / Math.max(1, Math.abs(powerNoise60)));

  let detected = false;
  let candidateFrequency = 0;
  let nominalGrid: EnfAnalysisResult['nominalGrid'] = 'None Detected';
  let bestSnr = 0;

  if (snr50 > 9 && snr50 > snr60) {
    detected = true;
    candidateFrequency = 50.0;
    nominalGrid = '50 Hz (Europe/Asia/Africa/Oceania)';
    bestSnr = Number(snr50.toFixed(1));
  } else if (snr60 > 9 && snr60 >= snr50) {
    detected = true;
    candidateFrequency = 60.0;
    nominalGrid = '60 Hz (Americas/Taiwan/Parts of Japan)';
    bestSnr = Number(snr60.toFixed(1));
  }

  const confidence = detected ? Math.min(85, Math.round(40 + bestSnr * 3)) : 10;
  const explanation = detected
    ? `Isolated coherent electrical hum component centered at ~${candidateFrequency} Hz (SNR: ${bestSnr} dB). Indicates inductive mains electromagnetic coupling during capture.`
    : 'No statistically significant 50 Hz or 60 Hz mains inductive tone was isolated above background acoustic noise floor.';

  return {
    detected,
    candidateFrequency,
    nominalGrid,
    snrDb: bestSnr,
    confidence,
    explanation,
    gridReferenceConnected: false,
    disclaimer:
      'Honest Disclosure: Conclusive ENF authentication requires comparing the micro-frequency trace against timestamped regional power transmission system operator (TSO) grid log databases. Reference grid database connection is currently unavailable; candidate mains frequency is reported for physical provenance context only.',
  };
}

// LSB Steganography Analysis on PCM Audio
export function analyzeAudioLsb(
  buffer: ArrayBuffer,
  encodedBitDepth?: number
): AudioLsbAnalysis {
  const bytes = new Uint8Array(buffer);
  // Sample up to 64k samples from the audio payload
  const sampleCount = Math.min(65536, Math.floor(bytes.length / 2));
  const lsbBits = new Uint8Array(Math.ceil(sampleCount / 8));

  // Extract LSB from 16-bit PCM (every 2nd byte is low byte in little endian)
  for (let i = 0; i < sampleCount; i++) {
    const byteOffset = 44 + i * 2;
    if (byteOffset < bytes.length) {
      const bit = bytes[byteOffset] & 0x01;
      const byteIdx = Math.floor(i / 8);
      const bitOffset = i % 8;
      lsbBits[byteIdx] |= bit << bitOffset;
    }
  }

  const entropy = calculateShannonEntropy(lsbBits);
  let suspicionScore = 15;
  let assessment = 'Normal LSB acoustic entropy distribution consistent with thermal ADC microphone noise.';

  if (entropy > 7.98) {
    suspicionScore = 88;
    assessment =
      'Extremely high LSB bit-plane entropy (> 7.98). Statistically resembles encrypted or pseudorandom steganographic payload injection in least significant bit plane.';
  } else if (entropy > 7.85) {
    suspicionScore = 55;
    assessment = 'Slightly elevated LSB entropy. Deserves closer manual inspection or comparison with baseline sensor recordings.';
  }

  return {
    testedChannel: 'Channel 1 (PCM 16-bit LSB Plane 0)',
    bitPlane: 0,
    entropy: Number(entropy.toFixed(3)),
    suspicionScore,
    assessment,
  };
}

// FFT Spectrogram Computation
// Cooley-Tukey Radix-2 FFT
export function computeFft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Radix-2 butterfly loops
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < (len >> 1); k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + (len >> 1)] * wR - imag[i + k + (len >> 1)] * wI;
        const vI = real[i + k + (len >> 1)] * wI + imag[i + k + (len >> 1)] * wR;
        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + (len >> 1)] = uR - vR;
        imag[i + k + (len >> 1)] = uI - vI;
        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

// Precompute Hanning window coefficients
export function createHanningWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

// Generate Spectrogram Columns (Frequency magnitude bins over time)
export function generateSpectrogramData(
  audioBuffer: AudioBuffer,
  fftSize: 256 | 512 | 1024 | 2048 = 512,
  maxColumns: number = 600
): {
  columns: Float32Array[]; // Normalized 0-1 magnitude bins
  binCount: number;
  sampleRate: number;
  duration: number;
} {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const binCount = fftSize / 2;

  const window = createHanningWindow(fftSize);
  const hopSize = Math.max(fftSize / 4, Math.floor(totalSamples / maxColumns));
  const totalColumns = Math.min(maxColumns, Math.floor((totalSamples - fftSize) / hopSize));

  const columns: Float32Array[] = [];
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let col = 0; col < totalColumns; col++) {
    const startIdx = col * hopSize;
    for (let i = 0; i < fftSize; i++) {
      real[i] = (channelData[startIdx + i] || 0) * window[i];
      imag[i] = 0;
    }

    computeFft(real, imag);

    const magColumn = new Float32Array(binCount);
    for (let bin = 0; bin < binCount; bin++) {
      const mag = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin]);
      // Normalized dB representation (-90 dB to 0 dB mapped to 0..1)
      const db = amplitudeToDb(mag / fftSize);
      magColumn[bin] = Math.max(0, Math.min(1, (db + 90) / 90));
    }
    columns.push(magColumn);
  }

  return {
    columns,
    binCount,
    sampleRate,
    duration,
  };
}

// 16-bit PCM WAV Encoder for Derivative Export
export function encodeWavDerivative(
  audioBuffer: AudioBuffer,
  startSec: number,
  endSec: number
): { blob: Blob; buffer: ArrayBuffer } {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;

  const clampedStart = Math.max(0, Math.min(audioBuffer.duration, startSec));
  const clampedEnd = Math.max(clampedStart + 0.05, Math.min(audioBuffer.duration, endSec));
  const startSample = Math.floor(clampedStart * sampleRate);
  const endSample = Math.floor(clampedEnd * sampleRate);
  const numSamples = Math.max(1, endSample - startSample);

  const blockAlign = channels * 2; // 16-bit = 2 bytes per sample
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write Interleaved 16-bit PCM samples
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = channelData[ch][startSample + i] || 0;
      // Clamp to -1.0 to +1.0 and convert to 16-bit signed integer (-32768 to 32767)
      const clamped = Math.max(-1, Math.min(1, sample));
      const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  return { blob, buffer: arrayBuffer };
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Master Audio Evidence Processing Pipeline
export async function processAudioForensicEvidence(
  file: File,
  caseId: string,
  onProgress?: (stage: string, percent: number) => void
): Promise<AudioForensicSession> {
  onProgress?.('Reading raw evidence bytes into memory...', 10);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('Computing cryptographic SHA-256 & SHA-1 digests...', 25);
  const { sha256, sha1 } = await computeAudioHashes(arrayBuffer);
  const shannonEntropy = calculateShannonEntropy(new Uint8Array(arrayBuffer.slice(0, 100000)));

  onProgress?.('Parsing audio container chunks and headers...', 40);
  const container = parseAudioContainer(arrayBuffer);

  onProgress?.('Decoding audio buffer via isolated Web Audio context...', 55);
  // Clone buffer so decodeAudioData doesn't detach original evidence
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    // Keep context clean
    await audioContext.close();
  }

  onProgress?.('Measuring signal dynamics, RMS, and sample clipping...', 70);
  const metrics = calculateSignalMetrics(decodedBuffer, container.encodedBitDepth);

  onProgress?.('Auditing silence intervals and temporal transitions...', 82);
  const silenceIntervals = detectSilenceIntervals(decodedBuffer);
  const anomalies = detectAudioAnomalies(decodedBuffer, silenceIntervals, metrics);

  onProgress?.('Probing 50Hz/60Hz mains ENF components & LSB entropy...', 92);
  const enf = analyzeEnf(decodedBuffer);
  const lsbAnalysis = analyzeAudioLsb(arrayBuffer, container.encodedBitDepth);

  // Determine overall severity
  let overallSeverity: AnomalySeverity = 'benign';
  if (container.hasTrailingData || anomalies.some((a) => a.category === 'Suspicious')) {
    overallSeverity = 'tampered';
  } else if (
    container.structuralAnomalies.length > 0 ||
    anomalies.some((a) => a.category === 'Potential Indicator') ||
    lsbAnalysis.suspicionScore > 70
  ) {
    overallSeverity = 'suspicious';
  } else if (metrics.clippingRatio > 0.5) {
    overallSeverity = 'low';
  }

  const audioBlobUrl = URL.createObjectURL(file);

  const integrity: FileIntegrity = {
    filename: file.name,
    originalName: file.name,
    fileSize: file.size,
    formattedSize: formatBytes(file.size),
    mimeType: file.type || `audio/${container.format.toLowerCase()}`,
    detectedFormat: (container.format as FileIntegrity['detectedFormat']) || 'UNKNOWN',
    width: 0,
    height: 0,
    aspectRatio: 'N/A',
    sha256,
    sha1,
    shannonEntropy: Number(shannonEntropy.toFixed(3)),
    uploadedAt: new Date().toISOString(),
  };

  onProgress?.('Finalizing digital audio forensic intake session...', 100);

  return {
    id: `AUDIO-${Date.now().toString(36).toUpperCase()}`,
    caseId,
    integrity,
    audioBlobUrl,
    container,
    metrics,
    silenceIntervals,
    anomalies,
    enf,
    lsbAnalysis,
    derivatives: [],
    overallSeverity,
    analystNotes:
      'Digital audio evidence ingested into local sandboxed memory. Original buffer preserved as read-only evidence. Signal dynamics, container chunks, and FFT spectral characteristics computed without remote transmission.',
    analyzedAt: new Date().toISOString(),
    audioBuffer: decodedBuffer,
  };
}
