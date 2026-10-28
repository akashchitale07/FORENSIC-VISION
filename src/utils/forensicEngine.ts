import {
  ImageForensicSession,
  FileIntegrity,
  ElaSettings,
  AnomalySeverity,
  BitPlaneAnalysis,
} from '../types/forensics';
import { computeFileHashes, formatBytes, sanitizeFilename, calculateAspectRatio } from './crypto';
import { analyzeBinaryStructure } from './binaryParser';
import { parseImageMetadata } from './metadataParser';
import { calculateHistogramFromPixels } from './histogram';
import {
  calculateBitPlaneEntropy,
  extractBitPlanePixels,
  evaluateLsbStego,
} from './steganography';
import { analyzeWatermarks } from './watermarkDetector';
import { performErrorLevelAnalysis } from './ela';

export interface ProgressCallback {
  (stage: string, percent: number): void;
}

export async function processForensicEvidence(
  file: File,
  caseId: string = 'CASE-001',
  elaSettings: ElaSettings = { jpegQuality: 85, scaleMultiplier: 20 },
  onProgress?: ProgressCallback
): Promise<ImageForensicSession> {
  const notify = (stage: string, pct: number) => {
    if (onProgress) onProgress(stage, pct);
  };

  // 1. Validation
  const maxBytes = 50 * 1024 * 1024; // 50MB limit
  if (file.size > maxBytes) {
    throw new Error(`File exceeds maximum evidence size limit of 50MB (size: ${formatBytes(file.size)})`);
  }

  notify('Reading evidence stream...', 10);
  const arrayBuffer = await file.arrayBuffer();

  // 2. Cryptographic Integrity Check
  notify('Computing SHA-256 and SHA-1 cryptographic hashes...', 20);
  const hashes = await computeFileHashes(arrayBuffer);

  // 3. Binary Structure & Entropy
  notify('Analyzing container binary structure and Shannon entropy...', 35);
  const binaryAnalysis = analyzeBinaryStructure(arrayBuffer);

  // 4. Decode Image for Canvas and Visual Processing
  notify('Decoding image bitmap and extracting dimensions...', 45);
  const objectUrl = URL.createObjectURL(file);
  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Corrupt or unsupported image stream: browser could not decode pixel data.'));
    img.src = objectUrl;
  });

  const width = imageElement.naturalWidth;
  const height = imageElement.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Image decoded with 0 dimensions; corrupt evidence file.');
  }

  // 5. Metadata Extraction (EXIF, IPTC, XMP, ICC, GPS)
  notify('Parsing EXIF, IPTC, and XMP metadata headers...', 55);
  const metadataResult = await parseImageMetadata(arrayBuffer);

  // 6. Canvas & Pixel Extraction
  notify('Rendering raster to pixel buffer for spatial inspection...', 65);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not initialize 2D canvas context');
  ctx.drawImage(imageElement, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;
  const pixelCount = width * height;

  // 7. Histogram & Color Dynamic Analysis
  notify('Calculating channel histograms, dynamic range, and clipping...', 75);
  const histogram = calculateHistogramFromPixels(pixels, pixelCount);

  // 8. Steganography & Bit-Plane Analysis
  notify('Executing LSB bit-plane analysis and spatial randomness tests...', 82);
  const bitPlanes: BitPlaneAnalysis[] = [];
  const channels: Array<'red' | 'green' | 'blue' | 'all'> = ['red', 'green', 'blue', 'all'];

  for (const ch of channels) {
    const offset = ch === 'red' ? 0 : ch === 'green' ? 1 : ch === 'blue' ? 2 : 0;
    const lsbStats = calculateBitPlaneEntropy(pixels, 0, offset);

    // Generate quick preview for LSB
    let previewDataUrl: string | undefined;
    try {
      const bitCanvas = document.createElement('canvas');
      // Downscale if image is large for memory efficiency
      const previewW = Math.min(width, 320);
      const previewH = Math.min(height, 240);
      bitCanvas.width = previewW;
      bitCanvas.height = previewH;
      const bCtx = bitCanvas.getContext('2d');
      if (bCtx) {
        // Draw downscaled to preview canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tCtx = tempCanvas.getContext('2d')!;
        const bitPixels = extractBitPlanePixels(pixels, width, height, 0, ch);
        const bitImgData = tCtx.createImageData(width, height);
        bitImgData.data.set(bitPixels);
        tCtx.putImageData(bitImgData, 0, 0);

        bCtx.drawImage(tempCanvas, 0, 0, previewW, previewH);
        previewDataUrl = bitCanvas.toDataURL('image/png');
      }
    } catch {
      // preview non-critical
    }

    bitPlanes.push({
      plane: 0,
      channel: ch,
      entropy: lsbStats.entropy,
      suspicionScore: lsbStats.entropy > 0.997 ? 85 : lsbStats.entropy > 0.985 ? 45 : 10,
      previewDataUrl,
    });
  }

  const lsbEval = evaluateLsbStego(bitPlanes);

  const stegoReport = {
    hasTrailingData: binaryAnalysis.hasTrailingData,
    trailingBytesCount: binaryAnalysis.trailingBytesCount,
    trailingDataHexPreview: binaryAnalysis.trailingDataHexPreview,
    structuralAnomalies: binaryAnalysis.structuralAnomalies,
    lsbEntropy: lsbEval.averageLsbEntropy,
    lsbAssessment: lsbEval.assessment,
    severity: binaryAnalysis.hasTrailingData
      ? ('suspicious' as AnomalySeverity)
      : lsbEval.severity,
    bitPlanes,
  };

  // 9. Watermark Analysis
  notify('Inspecting visible watermarks, edge variances, and AI signatures...', 88);
  const watermarkResult = analyzeWatermarks(pixels, width, height, metadataResult.entries);

  // 10. Error Level Analysis (ELA)
  notify('Performing JPEG Error Level Analysis (ELA)...', 94);
  let elaResult = null;
  if (binaryAnalysis.detectedFormat === 'JPEG' || file.type.includes('jpeg') || file.name.match(/\.jpe?g$/i)) {
    try {
      elaResult = await performErrorLevelAnalysis(imageElement, elaSettings);
    } catch {
      // Non-critical
    }
  }

  // 11. Determine Overall Anomaly Severity
  notify('Synthesizing forensic findings and chain of custody...', 98);
  let overallSeverity: AnomalySeverity = 'benign';

  if (stegoReport.hasTrailingData || (elaResult && elaResult.severity === 'tampered')) {
    overallSeverity = 'tampered';
  } else if (
    stegoReport.severity === 'suspicious' ||
    (elaResult && elaResult.severity === 'suspicious') ||
    watermarkResult.status === 'Detected'
  ) {
    overallSeverity = 'suspicious';
  } else if (
    watermarkResult.status === 'Potential Indicator' ||
    stegoReport.severity === 'low' ||
    binaryAnalysis.structuralAnomalies.length > 0
  ) {
    overallSeverity = 'low';
  }

  const fileIntegrity: FileIntegrity = {
    filename: sanitizeFilename(file.name),
    originalName: file.name,
    fileSize: file.size,
    formattedSize: formatBytes(file.size),
    mimeType: binaryAnalysis.mimeType,
    detectedFormat: binaryAnalysis.detectedFormat,
    width,
    height,
    aspectRatio: calculateAspectRatio(width, height),
    sha256: hashes.sha256,
    sha1: hashes.sha1,
    shannonEntropy: binaryAnalysis.shannonEntropy,
    uploadedAt: new Date().toISOString(),
  };

  notify('Analysis complete', 100);

  const sessionId = `SESSION-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  return {
    id: sessionId,
    caseId,
    integrity: fileIntegrity,
    previewUrl: objectUrl,
    metadata: metadataResult.entries,
    gps: metadataResult.gps,
    ela: elaResult,
    histogram,
    stego: stegoReport,
    watermark: watermarkResult,
    overallSeverity,
    analystNotes: '',
    analyzedAt: new Date().toISOString(),
  };
}
