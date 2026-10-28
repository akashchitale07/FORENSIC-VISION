export interface SampleAudioItem {
  id: string;
  title: string;
  filename: string;
  category: 'Clean Wiretap Baseline' | 'Tampered Splice / Cut' | 'Covert Trailing Stego Payload';
  description: string;
  expectedFindings: string[];
  generateBlob: () => Promise<File>;
}

// Synthesizes a PCM 16-bit WAV file from float samples
function createWavFromFloatSamples(
  samples: Float32Array,
  sampleRate: number = 44100,
  trailingBytes?: Uint8Array
): ArrayBuffer {
  const numSamples = samples.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * 2;
  const trailingLen = trailingBytes ? trailingBytes.length : 0;
  const totalBufferSize = 44 + dataSize + trailingLen;

  const buffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // Declared RIFF size (does not include trailing bytes if stego)
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  // If trailing stego bytes requested, append past the data chunk
  if (trailingBytes && trailingBytes.length > 0) {
    const byteView = new Uint8Array(buffer);
    byteView.set(trailingBytes, 44 + dataSize);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const SAMPLE_AUDIO_LIST: SampleAudioItem[] = [
  {
    id: 'sample-clean-wiretap',
    title: 'Surveillance Audio Baseline (Clean)',
    filename: 'surveillance_wiretap_clean.wav',
    category: 'Clean Wiretap Baseline',
    description:
      'Continuous 3.5-second surveillance room microphone recording with conversational voice frequency harmonics (440Hz, 880Hz), ambient room tone, and subtle 50Hz mains hum induction.',
    expectedFindings: [
      'Authentic continuous acoustic waveform',
      'Continuous background room tone without digital dropouts',
      'Isolated candidate 50Hz power grid induction hum',
      'Zero trailing bytes and valid RIFF container chunk hierarchy',
    ],
    generateBlob: async () => {
      const sampleRate = 44100;
      const duration = 3.5;
      const numSamples = Math.floor(sampleRate * duration);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Speech formant simulation (f1=440Hz, f2=880Hz, f3=1760Hz) modulated with speech cadence
        const speechEnvelope = 0.5 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t);
        const f1 = 0.3 * Math.sin(2 * Math.PI * 440 * t);
        const f2 = 0.15 * Math.sin(2 * Math.PI * 880 * t);
        const f3 = 0.08 * Math.sin(2 * Math.PI * 1760 * t);
        const speech = (f1 + f2 + f3) * speechEnvelope;

        // Subtle 50 Hz power mains hum
        const mainsHum = 0.04 * Math.sin(2 * Math.PI * 50.0 * t);

        // Low-level ambient noise (-40 dB)
        const roomNoise = (Math.random() * 2 - 1) * 0.015;

        samples[i] = speech + mainsHum + roomNoise;
      }

      const buffer = createWavFromFloatSamples(samples, sampleRate);
      return new File([buffer], 'surveillance_wiretap_clean.wav', { type: 'audio/wav' });
    },
  },
  {
    id: 'sample-tampered-splice',
    title: 'Interview Transcript Splice (Tampered)',
    filename: 'interview_spliced_tampered.wav',
    category: 'Tampered Splice / Cut',
    description:
      'Recorded voice deposition exhibiting an abrupt butt-splice at 1.80s, an unnatural frequency discontinuity from 520Hz to 1200Hz, and a 400ms muted silence dropout where room tone drops to zero.',
    expectedFindings: [
      'Potential Splice Point flagged at ~1.80s (+24 dB step in 25ms)',
      'Suspicious Silence dropout: abrupt silence at -90 dBFS without room tone decay',
      'Spectral flux discontinuity across splice boundary',
      'Overall Severity: TAMPERED / HIGH SUSPICION',
    ],
    generateBlob: async () => {
      const sampleRate = 44100;
      const duration = 4.2;
      const numSamples = Math.floor(sampleRate * duration);
      const samples = new Float32Array(numSamples);

      const spliceTime = 1.8;
      const silenceEnd = 2.2; // 400ms dropout

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;

        if (t >= spliceTime && t < silenceEnd) {
          // Zero digital silence dropout (splice cut)
          samples[i] = 0;
        } else if (t < spliceTime) {
          // Segment A: Tone 520Hz + ambient noise
          const tone = 0.35 * Math.sin(2 * Math.PI * 520 * t);
          const noise = (Math.random() * 2 - 1) * 0.02;
          samples[i] = tone + noise;
        } else {
          // Segment B: Abrupt jump to 1200Hz with high amplitude (+25 dB step)
          const tone = 0.75 * Math.sin(2 * Math.PI * 1200 * t);
          const noise = (Math.random() * 2 - 1) * 0.01;
          samples[i] = tone + noise;
        }
      }

      const buffer = createWavFromFloatSamples(samples, sampleRate);
      return new File([buffer], 'interview_spliced_tampered.wav', { type: 'audio/wav' });
    },
  },
  {
    id: 'sample-covert-stego',
    title: 'Field Audio with Appended Payload (Stego)',
    filename: 'field_recording_stego.wav',
    category: 'Covert Trailing Stego Payload',
    description:
      'Acoustic WAV audio file with 128 trailing covert payload bytes appended directly beyond the declared RIFF data chunk boundary.',
    expectedFindings: [
      'Detected 128 trailing bytes appended after valid data chunk boundary',
      'Covert steganography / payload injection indicator',
      'Hex preview of trailing payload bytes',
      'Overall Severity: TAMPERED / STRUCTURAL ANOMALY',
    ],
    generateBlob: async () => {
      const sampleRate = 44100;
      const duration = 3.0;
      const numSamples = Math.floor(sampleRate * duration);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const tone = 0.3 * Math.sin(2 * Math.PI * 350 * t);
        const noise = (Math.random() * 2 - 1) * 0.02;
        samples[i] = tone + noise;
      }

      // 128 bytes of covert payload (e.g. encrypted marker + hex pattern)
      const trailing = new Uint8Array(128);
      const secretMsg = 'FORENSIC_VISION_STEGO_FLAG{COVERT_CHANNEL_EXFILTRATION_TEST_PAYLOAD}';
      for (let i = 0; i < 128; i++) {
        trailing[i] = i < secretMsg.length ? secretMsg.charCodeAt(i) : 0xaa ^ (i * 7);
      }

      const buffer = createWavFromFloatSamples(samples, sampleRate, trailing);
      return new File([buffer], 'field_recording_stego.wav', { type: 'audio/wav' });
    },
  },
];
