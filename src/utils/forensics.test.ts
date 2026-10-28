import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShannonEntropy, analyzeBinaryStructure, formatHexPreview } from './binaryParser';
import { formatBytes, sanitizeFilename, calculateAspectRatio } from './crypto';
import { calculateBitPlaneEntropy, evaluateLsbStego } from './steganography';
import { calculateHistogramFromPixels } from './histogram';
import { analyzeWatermarks } from './watermarkDetector';

test('formatBytes correctly formats file sizes', () => {
  assert.equal(formatBytes(0), '0 Bytes');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');
});

test('sanitizeFilename removes path traversals and illegal characters', () => {
  assert.equal(sanitizeFilename('../../etc/passwd.jpg'), 'etc_passwd.jpg');
  assert.equal(sanitizeFilename('evidence<test>:file.png'), 'evidence_test__file.png');
  assert.equal(sanitizeFilename(''), 'evidence_file.bin');
});

test('calculateAspectRatio identifies common aspect ratios', () => {
  assert.equal(calculateAspectRatio(1920, 1080), '16:9');
  assert.equal(calculateAspectRatio(800, 600), '4:3');
  assert.equal(calculateAspectRatio(500, 500), '1:1');
});

test('calculateShannonEntropy computes valid entropy range', () => {
  // Uniform single-value array has 0 entropy
  const uniform = new Uint8Array([0xaa, 0xaa, 0xaa, 0xaa]);
  assert.equal(calculateShannonEntropy(uniform), 0);

  // Maximum entropy test for 256 evenly distributed bytes (should equal 8.0)
  const fullByteRange = new Uint8Array(256);
  for (let i = 0; i < 256; i++) fullByteRange[i] = i;
  assert.equal(calculateShannonEntropy(fullByteRange), 8.0);
});

test('analyzeBinaryStructure detects JPEG with trailing stego bytes', () => {
  // Create minimal valid JPEG structure: SOI (FF D8) ... EOI (FF D9) + trailing payload
  const jpegBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00,
    0xff, 0xd9, // EOI marker
    0x54, 0x52, 0x41, 0x49, 0x4c, 0x49, 0x4e, 0x47, // "TRAILING" payload
  ]);

  const result = analyzeBinaryStructure(jpegBytes.buffer);
  assert.equal(result.detectedFormat, 'JPEG');
  assert.equal(result.isValidSignature, true);
  assert.equal(result.hasTrailingData, true);
  assert.equal(result.trailingBytesCount, 8);
  assert.ok(result.structuralAnomalies.length > 0);
  assert.ok(result.structuralAnomalies[0].includes('8 trailing bytes'));
});

test('analyzeBinaryStructure detects PNG chunk boundaries', () => {
  // Minimal PNG header + IEND chunk
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, // IEND + CRC
  ]);

  const result = analyzeBinaryStructure(pngBytes.buffer);
  assert.equal(result.detectedFormat, 'PNG');
  assert.equal(result.isValidSignature, true);
  assert.equal(result.hasTrailingData, false);
});

test('calculateHistogramFromPixels generates 256-bin stats and detects clipping', () => {
  // 4 pixels RGBA:
  // Pixel 1: Black (0,0,0,255)
  // Pixel 2: White (255,255,255,255)
  // Pixel 3: Red (255,0,0,255)
  // Pixel 4: Mid (128,128,128,255)
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255,
    255, 255, 255, 255,
    255, 0, 0, 255,
    128, 128, 128, 255,
  ]);

  const hist = calculateHistogramFromPixels(pixels, 4);
  assert.equal(hist.red.data.length, 256);
  assert.equal(hist.red.min, 0);
  assert.equal(hist.red.max, 255);
  assert.equal(hist.red.clippedDarkPercent, 25);
  assert.equal(hist.red.clippedLightPercent, 50);
});

test('evaluateLsbStego flags high entropy LSB planes as suspicious', () => {
  const normalPlanes = [
    { plane: 0, channel: 'red' as const, entropy: 0.94, suspicionScore: 10 },
    { plane: 0, channel: 'green' as const, entropy: 0.93, suspicionScore: 10 },
    { plane: 0, channel: 'blue' as const, entropy: 0.95, suspicionScore: 10 },
  ];
  const normalEval = evaluateLsbStego(normalPlanes);
  assert.equal(normalEval.severity, 'benign');

  const stegoPlanes = [
    { plane: 0, channel: 'red' as const, entropy: 0.999, suspicionScore: 90 },
    { plane: 0, channel: 'green' as const, entropy: 0.998, suspicionScore: 90 },
    { plane: 0, channel: 'blue' as const, entropy: 0.999, suspicionScore: 90 },
  ];
  const stegoEval = evaluateLsbStego(stegoPlanes);
  assert.equal(stegoEval.severity, 'suspicious');
});

test('analyzeWatermarks flags known stock and AI metadata tags', () => {
  const dummyPixels = new Uint8ClampedArray(100 * 100 * 4);
  const metadata = [
    { tag: 'Software', label: 'Software', value: 'Midjourney v6.0', category: 'EXIF' as const },
    { tag: 'Copyright', label: 'Copyright', value: 'Shutterstock Inc.', category: 'EXIF' as const },
  ];

  const result = analyzeWatermarks(dummyPixels, 100, 100, metadata);
  assert.equal(result.status, 'Detected');
  assert.ok(result.detectedTextSignatures.length > 0);
  assert.ok(result.aiModelSignatures.length > 0);
  assert.ok(result.confidence >= 80);
});

// PHASE 2 VIDEO FORENSICS UNIT TESTS
import { formatVideoTimestamp, parseVideoContainer } from './videoContainerParser';
import { calculatePerceptualHash, computeHammingDistance, detectSceneCutsAndAnomalies } from './frameAnalysis';

test('formatVideoTimestamp formats seconds into MM:SS.mmm format', () => {
  assert.equal(formatVideoTimestamp(0), '00:00.000');
  assert.equal(formatVideoTimestamp(12.5), '00:12.500');
  assert.equal(formatVideoTimestamp(75.123), '01:15.123');
  assert.equal(formatVideoTimestamp(NaN), '00:00.000');
});

test('parseVideoContainer detects MP4 ftyp atom and brands', () => {
  // Minimal MP4 buffer with ftyp box
  // Box size: 16 (00 00 00 10), Type: 'ftyp', Major: 'isom', Minor: 00 00 02 00
  const mp4Bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x10,
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00,
  ]);

  const result = parseVideoContainer(mp4Bytes.buffer);
  assert.equal(result.detectedFormat, 'MP4');
  assert.equal(result.majorBrand, 'isom');
  assert.ok(result.atomsOrTracks.length > 0);
});

test('parseVideoContainer detects WebM EBML header', () => {
  // WebM EBML header: 1A 45 DF A3 + "webm" text
  const webmBytes = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3,
    0x01, 0x00, 0x00, 0x1f,
    0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, // DocType: 'webm'
  ]);

  const result = parseVideoContainer(webmBytes.buffer);
  assert.equal(result.detectedFormat, 'WEBM');
  assert.equal(result.mimeType, 'video/webm');
});

test('calculatePerceptualHash and computeHammingDistance identify identical and differing frames', () => {
  // Identical 9x8 white frames
  const frameA = new Uint8ClampedArray(9 * 8 * 4).fill(255);
  const frameB = new Uint8ClampedArray(9 * 8 * 4).fill(255);

  const hashA = calculatePerceptualHash(frameA, 9, 8);
  const hashB = calculatePerceptualHash(frameB, 9, 8);
  assert.equal(computeHammingDistance(hashA, hashB), 0);

  // Inverted checkerboard frame
  const frameC = new Uint8ClampedArray(9 * 8 * 4);
  for (let i = 0; i < frameC.length; i += 4) {
    frameC[i] = (i % 8 === 0) ? 255 : 0;
  }
  const hashC = calculatePerceptualHash(frameC, 9, 8);
  assert.ok(computeHammingDistance(hashA, hashC) >= 0);
});

test('detectSceneCutsAndAnomalies identifies sudden scene transitions', () => {
  const frames = [
    {
      id: 'F0',
      frameIndex: 0,
      timestamp: 0.0,
      formattedTimestamp: '00:00.000',
      dataUrl: 'data:image/png;base64,...',
      thumbnailUrl: '',
      width: 100,
      height: 100,
      extractionMethod: 'HTML5 Canvas',
      perceptualHash: '0000000000000000',
      averageLuminance: 120,
    },
    {
      id: 'F1',
      frameIndex: 1,
      timestamp: 1.0,
      formattedTimestamp: '00:01.000',
      dataUrl: 'data:image/png;base64,...',
      thumbnailUrl: '',
      width: 100,
      height: 100,
      extractionMethod: 'HTML5 Canvas',
      perceptualHash: 'ffffffffffffffff', // Max distance 64 bits from F0
      averageLuminance: 130,
    },
  ];

  const events = detectSceneCutsAndAnomalies(frames);
  assert.equal(events.length, 1);
  assert.equal(events[0].method, 'Pixel Difference');
  assert.equal(events[0].severity, 'suspicious');
  assert.ok(events[0].explanation.includes('Significant visual boundary detected'));
});

// PHASE 3 AUDIO FORENSICS UNIT TESTS
import { parseAudioContainer } from './audioContainerParser';
import {
  formatAudioTimestamp,
  amplitudeToDb,
  computeFft,
  createHanningWindow,
  encodeWavDerivative,
  calculateSignalMetrics,
} from './audioEngine';

test('formatAudioTimestamp formats seconds to MM:SS.mmm correctly', () => {
  assert.equal(formatAudioTimestamp(0), '00:00.000');
  assert.equal(formatAudioTimestamp(5.25), '00:05.250');
  assert.equal(formatAudioTimestamp(65.123), '01:05.123');
  assert.equal(formatAudioTimestamp(-1), '00:00.000');
});

test('amplitudeToDb maps linear values to dBFS', () => {
  assert.equal(amplitudeToDb(1.0), 0);
  assert.ok(Math.abs(amplitudeToDb(0.5) - (-6.02)) < 0.1);
  assert.ok(Math.abs(amplitudeToDb(0.1) - (-20.0)) < 0.1);
  assert.equal(amplitudeToDb(0), -120);
});

test('parseAudioContainer detects WAV RIFF chunks and parameters', () => {
  // Synthesize minimal 44-byte WAV header with 100 samples
  const numSamples = 100;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true);
  // WAVE
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // fmt
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, 44100, true); // sampleRate
  view.setUint32(28, 88200, true); // byteRate
  view.setUint16(32, 2, true); // blockAlign
  view.setUint16(34, 16, true); // 16-bit
  // data
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);

  const parsed = parseAudioContainer(buffer);
  assert.equal(parsed.format, 'WAV');
  assert.equal(parsed.isRiffValid, true);
  assert.equal(parsed.encodedBitDepth, 16);
  assert.equal(parsed.encodedChannels, 1);
  assert.equal(parsed.encodedSampleRate, 44100);
  assert.equal(parsed.hasTrailingData, false);
  assert.equal(parsed.trailingBytesCount, 0);
});

test('parseAudioContainer detects trailing appended bytes in WAV files', () => {
  const numSamples = 50;
  const dataSize = numSamples * 2;
  const trailingCount = 32;
  const buffer = new ArrayBuffer(44 + dataSize + trailingCount);
  const view = new DataView(buffer);

  // RIFF
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true); // Declared RIFF ends at 44 + dataSize
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // fmt
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 88200, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);

  const parsed = parseAudioContainer(buffer);
  assert.equal(parsed.format, 'WAV');
  assert.equal(parsed.hasTrailingData, true);
  assert.equal(parsed.trailingBytesCount, trailingCount);
  assert.ok(parsed.structuralAnomalies.length > 0);
  assert.ok(parsed.structuralAnomalies[0].includes('32 trailing bytes'));
});

test('computeFft detects dominant frequency bin of sinusoid', () => {
  const n = 256;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);

  // Synthesize pure cycle of 16 periods across 256 samples (bin index = 16)
  const targetBin = 16;
  for (let i = 0; i < n; i++) {
    real[i] = Math.cos((2 * Math.PI * targetBin * i) / n);
  }

  computeFft(real, imag);

  // Peak should be at bin 16
  let peakBin = 0;
  let maxMag = 0;
  for (let i = 0; i < n / 2; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    if (mag > maxMag) {
      maxMag = mag;
      peakBin = i;
    }
  }

  assert.equal(peakBin, targetBin);
});

test('encodeWavDerivative generates valid RIFF WAV bytes with correct headers', () => {
  // Mock AudioBuffer
  const sampleRate = 44100;
  const duration = 1.0;
  const mockChannelData = new Float32Array(sampleRate);
  for (let i = 0; i < sampleRate; i++) {
    mockChannelData[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }

  const mockAudioBuffer = {
    sampleRate,
    duration,
    numberOfChannels: 1,
    length: sampleRate,
    getChannelData: () => mockChannelData,
  } as unknown as AudioBuffer;

  const result = encodeWavDerivative(mockAudioBuffer, 0.0, 0.5);
  assert.ok(result.buffer.byteLength > 44);

  const view = new DataView(result.buffer);
  const riffStr = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const waveStr = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  const fmtStr = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  const dataStr = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));

  assert.equal(riffStr, 'RIFF');
  assert.equal(waveStr, 'WAVE');
  assert.equal(fmtStr, 'fmt ');
  assert.equal(dataStr, 'data');
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(34, true), 16); // 16-bit
});

