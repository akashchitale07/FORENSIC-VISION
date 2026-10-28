export type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error';

export type AnomalySeverity = 'benign' | 'low' | 'suspicious' | 'tampered' | 'inconclusive';

export interface FileIntegrity {
  filename: string;
  originalName: string;
  fileSize: number;
  formattedSize: string;
  mimeType: string;
  detectedFormat: 'JPEG' | 'PNG' | 'WEBP' | 'TIFF' | 'MP4' | 'MOV' | 'WEBM' | 'MKV' | 'UNKNOWN';
  width: number;
  height: number;
  aspectRatio: string;
  sha256: string;
  sha1: string;
  shannonEntropy: number;
  uploadedAt: string;
}

export interface MetadataEntry {
  tag: string;
  label: string;
  value: string;
  category: 'EXIF' | 'IPTC' | 'XMP' | 'ICC' | 'FILE' | 'GPS' | 'CONTAINER' | 'CODEC' | 'TRACK';
  description?: string;
}

export interface GpsData {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: string;
  formattedCoords?: string;
  googleMapsUrl?: string;
}

export interface ElaSettings {
  jpegQuality: number; // 60 to 95
  scaleMultiplier: number; // 10 to 40
}

export interface ElaResult {
  elaDataUrl: string;
  averageDisparity: number;
  maxDisparity: number;
  highDisparityRatio: number;
  assessment: string;
  severity: AnomalySeverity;
  notes: string[];
}

export interface HistogramChannel {
  data: number[]; // 256 bins
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  clippedDarkPercent: number; // bin 0
  clippedLightPercent: number; // bin 255
}

export interface HistogramAnalysis {
  red: HistogramChannel;
  green: HistogramChannel;
  blue: HistogramChannel;
  luminance: HistogramChannel;
  dynamicRangePercent: number;
  entropy: number;
}

export interface BitPlaneAnalysis {
  plane: number; // 0 to 7 (0 is LSB)
  channel: 'red' | 'green' | 'blue' | 'all';
  entropy: number;
  suspicionScore: number; // 0 to 100
  previewDataUrl?: string;
}

export interface StegoReport {
  hasTrailingData: boolean;
  trailingBytesCount: number;
  trailingDataHexPreview?: string;
  structuralAnomalies: string[];
  lsbEntropy: number;
  lsbAssessment: string;
  severity: AnomalySeverity;
  bitPlanes: BitPlaneAnalysis[];
}

export interface WatermarkDetectionResult {
  status: 'Detected' | 'Potential Indicator' | 'Not Detected by Supported Checks' | 'Inconclusive';
  confidence: number; // 0 - 100
  candidateAreasCount: number;
  detectedTextSignatures: string[];
  aiModelSignatures: string[];
  findings: string[];
  limitations: string;
  candidateOverlayDataUrl?: string;
}

export interface ImageForensicSession {
  id: string;
  caseId: string;
  integrity: FileIntegrity;
  previewUrl: string;
  metadata: MetadataEntry[];
  gps: GpsData;
  ela: ElaResult | null;
  histogram: HistogramAnalysis | null;
  stego: StegoReport | null;
  watermark: WatermarkDetectionResult | null;
  overallSeverity: AnomalySeverity;
  analystNotes: string;
  analyzedAt: string;
}

// -------------------------------------------------------------
// PHASE 2: VIDEO FORENSICS DATA MODELS
// -------------------------------------------------------------

export interface VideoAtomInfo {
  name: string;
  offset: number;
  size: number;
  details?: string;
}

export interface VideoIntegrity extends FileIntegrity {
  duration: number; // in seconds
  formattedDuration: string;
  frameRate: number; // e.g. 30, 24, 29.97 or estimated
  estimatedFrameCount: number;
  bitrateKbps: number;
  videoCodec: string; // e.g. "H.264 / AVC (avc1)", "VP8", "VP9", "AV1"
  audioCodec: string; // e.g. "AAC (mp4a)", "Opus", "None"
  hasAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  creationDate?: string;
  rotation?: number; // 0, 90, 180, 270
  moovPosition?: 'before_mdat (fast-start / web-optimized)' | 'after_mdat (standard)' | 'not_applicable';
  atomsOrTracks: VideoAtomInfo[];
  unavailableFeatures: string[];
}

export interface ExtractedFrame {
  id: string;
  frameIndex: number;
  timestamp: number;
  formattedTimestamp: string;
  dataUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  extractionMethod: string;
  perceptualHash: string; // 64-bit dHash
  averageLuminance: number;
}

export interface FrameTamperingEvent {
  id: string;
  timestamp: number;
  formattedTimestamp: string;
  frameIndex: number;
  method: 'Pixel Difference' | 'Histogram Divergence' | 'Near-Duplicate Frame' | 'Timestamp Discontinuity' | 'Metadata Irregularity';
  metric: string; // e.g. "Difference: 42.1%", "dHash Distance: 2"
  differencePercent: number;
  severity: AnomalySeverity;
  explanation: string;
  frameDataUrl?: string;
  previousFrameDataUrl?: string;
  differenceMapDataUrl?: string;
}

export interface VideoForensicSession {
  id: string;
  caseId: string;
  integrity: VideoIntegrity;
  videoBlobUrl: string;
  metadataEntries: MetadataEntry[];
  extractedFrames: ExtractedFrame[];
  tamperingEvents: FrameTamperingEvent[];
  watermark: WatermarkDetectionResult;
  samplingIntervalSeconds: number;
  overallSeverity: AnomalySeverity;
  analystNotes: string;
  analyzedAt: string;
}

// -------------------------------------------------------------
// PHASE 3: AUDIO FORENSICS DATA MODELS
// -------------------------------------------------------------

export interface AudioChunkInfo {
  id: string; // e.g. "RIFF", "fmt ", "data", "LIST", "id3 "
  offset: number;
  size: number;
  description: string;
}

export interface AudioContainerInspection {
  format: 'WAV' | 'MP3' | 'M4A' | 'AAC' | 'FLAC' | 'OGG' | 'WEBM' | 'UNKNOWN';
  isRiffValid?: boolean;
  riffSizeDeclared?: number;
  actualFileSize: number;
  dataChunkOffset?: number;
  dataChunkSize?: number;
  trailingBytesCount: number;
  trailingDataHexPreview?: string;
  hasTrailingData: boolean;
  encodedBitDepth?: number; // from container header e.g. 16, 24, 32
  encodedChannels?: number;
  encodedSampleRate?: number;
  audioEncodingFormat?: string; // e.g. "PCM (Uncompressed)", "IEEE Float", "MPEG Layer-3", "AAC"
  chunks: AudioChunkInfo[];
  structuralAnomalies: string[];
}

export interface AudioSignalMetrics {
  duration: number; // in seconds
  formattedDuration: string;
  sampleRate: number; // e.g. 44100, 48000
  channels: number; // 1 (mono), 2 (stereo), etc.
  totalSamples: number;
  peakDbFs: number; // Peak amplitude in dBFS (<= 0 dBFS)
  rmsDbFs: number; // Root Mean Square amplitude in dBFS
  dynamicRangeDb: number;
  clippingCount: number; // samples >= -0.05 dBFS
  clippingRatio: number; // percentage of clipped samples
  zeroCrossingRate: number;
  spectralCentroidHz: number;
  dcOffset: number;
  channelBalanceRatio?: number; // left/right ratio
}

export interface AudioSilenceInterval {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  formattedRange: string;
  avgDbFs: number;
  isAbrupt: boolean;
}

export interface AudioAnomalyMarker {
  id: string;
  timestamp: number;
  formattedTimestamp: string;
  durationMs?: number;
  category: 'Informational' | 'Potential Indicator' | 'Suspicious' | 'Inconclusive';
  type:
    | 'Amplitude Jump'
    | 'Spectral Discontinuity'
    | 'Suspicious Silence'
    | 'Clipping / Saturation'
    | 'Potential Splice Point'
    | 'Channel Asymmetry'
    | 'DC Offset Shift';
  confidence: number; // 0 - 100
  metric: string; // e.g. "+18.4 dB Jump in 23ms"
  explanation: string;
  alternativeHypothesis: string; // Benign explanation (e.g. natural transient, phoneme stop)
}

export interface EnfAnalysisResult {
  detected: boolean;
  candidateFrequency: number; // e.g. 50.02 or 59.98
  nominalGrid: '50 Hz (Europe/Asia/Africa/Oceania)' | '60 Hz (Americas/Taiwan/Parts of Japan)' | 'None Detected';
  snrDb: number;
  confidence: number;
  explanation: string;
  gridReferenceConnected: boolean;
  disclaimer: string;
}

export interface AudioLsbAnalysis {
  testedChannel: string;
  bitPlane: number;
  entropy: number;
  suspicionScore: number;
  assessment: string;
}

export interface AudioDerivative {
  id: string;
  filename: string;
  derivedAt: string;
  startTime: number;
  endTime: number;
  formattedTimeRange: string;
  duration: number;
  sha256: string;
  sha1: string;
  fileSize: number;
  sampleRate: number;
  channels: number;
  format: 'WAV (16-bit PCM)';
  blobUrl: string;
}

export interface AudioForensicSession {
  id: string;
  caseId: string;
  integrity: FileIntegrity;
  audioBlobUrl: string;
  container: AudioContainerInspection;
  metrics: AudioSignalMetrics;
  silenceIntervals: AudioSilenceInterval[];
  anomalies: AudioAnomalyMarker[];
  enf: EnfAnalysisResult;
  lsbAnalysis: AudioLsbAnalysis;
  derivatives: AudioDerivative[];
  overallSeverity: AnomalySeverity;
  analystNotes: string;
  analyzedAt: string;
  // AudioBuffer reference held transiently in memory for canvas playback & visualization
  audioBuffer?: AudioBuffer;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  investigator: string;
  agency?: string;
  createdAt: string;
  updatedAt: string;
  status: 'Open' | 'In Review' | 'Closed';
  notes: string;
  evidenceSessionIds: string[];
  videoEvidenceSessionIds?: string[];
  audioEvidenceSessionIds?: string[];
}
