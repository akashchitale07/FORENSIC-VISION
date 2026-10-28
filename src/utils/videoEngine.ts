/**
 * Forensic Video Ingestion & Analysis Orchestration Engine.
 * Extracts container metadata, samples frames, computes cryptographic digests,
 * and detects frame-to-frame tampering events.
 */

import {
  VideoForensicSession,
  VideoIntegrity,
  ExtractedFrame,
  FrameTamperingEvent,
  AnomalySeverity,
  WatermarkDetectionResult,
} from '../types/forensics';
import { computeFileHashes, formatBytes, sanitizeFilename, calculateAspectRatio } from './crypto';
import { parseVideoContainer, formatVideoTimestamp } from './videoContainerParser';
import { calculatePerceptualHash, detectSceneCutsAndAnomalies } from './frameAnalysis';
import { analyzeWatermarks } from './watermarkDetector';

export interface VideoProgressCallback {
  (stage: string, percent: number): void;
}

export async function processVideoForensicEvidence(
  file: File,
  caseId: string = 'CASE-001',
  sampleIntervalSeconds: number = 0.5,
  onProgress?: VideoProgressCallback
): Promise<VideoForensicSession> {
  const notify = (stage: string, pct: number) => {
    if (onProgress) onProgress(stage, pct);
  };

  // 1. Validation
  const maxBytes = 100 * 1024 * 1024; // 100MB limit
  if (file.size > maxBytes) {
    throw new Error(`File exceeds maximum video evidence size limit of 100MB (size: ${formatBytes(file.size)})`);
  }

  notify('Reading raw video evidence stream...', 10);
  const arrayBuffer = await file.arrayBuffer();

  // 2. Cryptographic Integrity Digest
  notify('Computing SHA-256 and SHA-1 cryptographic hashes...', 25);
  const hashes = await computeFileHashes(arrayBuffer);

  // 3. Binary Container Inspection (MP4 ISOBMFF / WebM EBML)
  notify('Inspecting container structure, atom hierarchy, and codec FourCC...', 40);
  const container = parseVideoContainer(arrayBuffer);

  // 4. Mount Video Element to decode stream
  notify('Initializing HTML5 video decoder and extracting stream properties...', 55);
  const blobUrl = URL.createObjectURL(file);

  const videoElement = document.createElement('video');
  videoElement.preload = 'auto';
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.src = blobUrl;

  await new Promise<void>((resolve, reject) => {
    videoElement.onloadedmetadata = () => resolve();
    videoElement.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Browser was unable to decode the video container or codec. Supported formats: MP4 (H.264), WebM (VP8/VP9/AV1), MOV.'));
    };
  });

  // Obtain strictly finite duration
  let duration = container.containerDurationSec || 0;
  if (!isFinite(duration) || duration <= 0) {
    if (isFinite(videoElement.duration) && videoElement.duration > 0) {
      duration = videoElement.duration;
    } else {
      // Chrome MediaRecorder WebM: duration may initially be Infinity. Seek to determine end of stream.
      try {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 350);
          videoElement.addEventListener(
            'seeked',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
          videoElement.currentTime = 1e6;
        });

        if (isFinite(videoElement.duration) && videoElement.duration > 0) {
          duration = videoElement.duration;
        } else if (videoElement.seekable && videoElement.seekable.length > 0) {
          const end = videoElement.seekable.end(videoElement.seekable.length - 1);
          if (isFinite(end) && end > 0) duration = end;
        }
        videoElement.currentTime = 0;
      } catch {
        // Continue with fallback
      }
    }
  }

  // Fallback to finite positive duration if still undetermined
  if (!isFinite(duration) || duration <= 0) {
    duration = 3.5;
  }

  const width = videoElement.videoWidth || container.trackWidth || 640;
  const height = videoElement.videoHeight || container.trackHeight || 480;

  // 5. Frame Sampling Extraction
  notify('Sampling video frames across timeline for spatial comparison...', 65);
  const extractedFrames: ExtractedFrame[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context for frame extraction');

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 160;
  thumbCanvas.height = Math.round((160 / width) * height);
  const thumbCtx = thumbCanvas.getContext('2d');

  // Determine sampling interval (sample at least 5 frames, max 24 frames for memory safety)
  let actualInterval = Math.max(0.2, sampleIntervalSeconds);
  if (!isFinite(actualInterval) || actualInterval <= 0) actualInterval = 0.5;

  const potentialCount = Math.floor(duration / actualInterval);
  if (potentialCount > 24) {
    actualInterval = duration / 24;
  } else if (potentialCount < 4 && duration > 0.5) {
    actualInterval = duration / 5;
  }
  if (!isFinite(actualInterval) || actualInterval <= 0) actualInterval = 0.5;

  let sampleTime = 0;
  let frameIndex = 0;

  while (sampleTime <= duration && extractedFrames.length < 24) {
    await seekVideo(videoElement, sampleTime);
    ctx.drawImage(videoElement, 0, 0, width, height);

    const frameImageData = ctx.getImageData(0, 0, width, height);
    const pixels = frameImageData.data;

    // Perceptual dHash
    const pHash = calculatePerceptualHash(pixels, width, height);

    // Calculate mean luminance
    let lumSum = 0;
    const sampleStep = Math.max(1, Math.floor(pixels.length / 4000));
    let sampleCount = 0;
    for (let i = 0; i < pixels.length; i += 4 * sampleStep) {
      lumSum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      sampleCount++;
    }
    const avgLum = sampleCount > 0 ? lumSum / sampleCount : 128;

    // High-res frame dataUrl
    const dataUrl = canvas.toDataURL('image/png');

    // Thumbnail dataUrl
    let thumbUrl = dataUrl;
    if (thumbCtx) {
      thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
    }

    extractedFrames.push({
      id: `FRAME-${frameIndex}`,
      frameIndex,
      timestamp: Number(sampleTime.toFixed(3)),
      formattedTimestamp: formatVideoTimestamp(sampleTime),
      dataUrl,
      thumbnailUrl: thumbUrl,
      width,
      height,
      extractionMethod: 'HTML5 Canvas Decoded Frame',
      perceptualHash: pHash,
      averageLuminance: Number(avgLum.toFixed(2)),
    });

    frameIndex++;
    sampleTime += actualInterval;

    const progressPct = 65 + Math.round((sampleTime / duration) * 20);
    notify(`Extracted frame ${frameIndex} at ${formatVideoTimestamp(sampleTime)}...`, Math.min(85, progressPct));
  }

  // 6. Frame Difference & Tampering Event Detection
  notify('Analyzing frame-to-frame pixel differences and scene cut events...', 88);
  const tamperingEvents = detectSceneCutsAndAnomalies(extractedFrames);

  // 7. Watermark Detection on Extracted Frames
  notify('Inspecting video frames for persistent corner watermark badges...', 94);
  let watermarkResult: WatermarkDetectionResult = {
    status: 'Not Detected by Supported Checks',
    confidence: 15,
    candidateAreasCount: 0,
    detectedTextSignatures: [],
    aiModelSignatures: [],
    findings: [],
    limitations: 'Video watermark checks inspect spatial corner heuristics on extracted frame samples and container metadata tags. Invisible neural watermarks require proprietary algorithmic detectors.',
  };

  if (extractedFrames.length > 0) {
    const midFrame = extractedFrames[Math.floor(extractedFrames.length / 2)];
    // Test mid frame pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d')!;
    const img = new Image();
    img.src = midFrame.dataUrl;
    await new Promise((r) => (img.onload = r));
    tCtx.drawImage(img, 0, 0);
    const fPixels = tCtx.getImageData(0, 0, width, height).data;

    watermarkResult = analyzeWatermarks(fPixels, width, height, container.metadataEntries);
  }

  // 8. Overall Severity Synthesis
  notify('Synthesizing video forensic report and chain of custody...', 98);
  let overallSeverity: AnomalySeverity = 'benign';

  const hasSuspiciousEvent = tamperingEvents.some((e) => e.severity === 'suspicious');
  const hasTamperedEvent = tamperingEvents.some((e) => e.severity === 'tampered');

  if (hasTamperedEvent) {
    overallSeverity = 'tampered';
  } else if (hasSuspiciousEvent || watermarkResult.status === 'Detected') {
    overallSeverity = 'suspicious';
  } else if (tamperingEvents.length > 0 || watermarkResult.status === 'Potential Indicator') {
    overallSeverity = 'low';
  }

  const bitrateKbps = duration > 0 ? Math.round((file.size * 8) / (duration * 1024)) : 0;
  const frameRate = 30; // Estimated standard baseline if not available in container atom
  const estimatedFrameCount = Math.round(duration * frameRate);

  const videoIntegrity: VideoIntegrity = {
    filename: sanitizeFilename(file.name),
    originalName: file.name,
    fileSize: file.size,
    formattedSize: formatBytes(file.size),
    mimeType: container.mimeType,
    detectedFormat: container.detectedFormat,
    width,
    height,
    aspectRatio: calculateAspectRatio(width, height),
    sha256: hashes.sha256,
    sha1: hashes.sha1,
    shannonEntropy: container.shannonEntropy,
    uploadedAt: new Date().toISOString(),
    duration,
    formattedDuration: formatVideoTimestamp(duration),
    frameRate,
    estimatedFrameCount,
    bitrateKbps,
    videoCodec: container.videoCodecFourCC || 'AVC / H.264',
    audioCodec: container.audioCodecFourCC || (container.hasAudio ? 'AAC' : 'None'),
    hasAudio: container.hasAudio,
    audioChannels: container.audioChannels,
    audioSampleRate: container.audioSampleRate,
    creationDate: container.creationDate,
    rotation: container.rotation,
    moovPosition: container.moovPosition,
    atomsOrTracks: container.atomsOrTracks,
    unavailableFeatures: container.unavailableFeatures,
  };

  notify('Video analysis completed', 100);

  const sessionId = `VID-SESSION-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  return {
    id: sessionId,
    caseId,
    integrity: videoIntegrity,
    videoBlobUrl: blobUrl,
    metadataEntries: container.metadataEntries,
    extractedFrames,
    tamperingEvents,
    watermark: watermarkResult,
    samplingIntervalSeconds: actualInterval,
    overallSeverity,
    analystNotes: '',
    analyzedAt: new Date().toISOString(),
  };
}

function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    let target = isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    if (isFinite(video.duration) && video.duration > 0) {
      target = Math.min(target, Math.max(0, video.duration - 0.05));
    }
    if (!isFinite(target) || isNaN(target)) {
      target = 0;
    }

    const timer = setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    }, 400);

    const handleSeeked = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    };

    video.addEventListener('seeked', handleSeeked);
    try {
      video.currentTime = target;
    } catch {
      clearTimeout(timer);
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    }
  });
}
