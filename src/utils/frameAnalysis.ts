/**
 * Frame-level pixel difference calculation, perceptual dHash similarity,
 * and abrupt visual change / scene-transition detection.
 */

import { ExtractedFrame, FrameTamperingEvent, AnomalySeverity } from '../types/forensics';
import { formatVideoTimestamp } from './videoContainerParser';

export interface FrameDifferenceResult {
  mae: number; // Mean Absolute Error (0 - 255)
  differencePercent: number; // Percentage of pixels with significant disparity
  differenceMapDataUrl?: string;
}

/**
 * Computes pixel disparity and generates an amplified difference heatmap
 */
export function compareFramePixels(
  data1: Uint8ClampedArray,
  data2: Uint8ClampedArray,
  width: number,
  height: number,
  generateDifferenceMap: boolean = false
): FrameDifferenceResult {
  const pixelCount = width * height;
  if (data1.length !== data2.length || pixelCount === 0) {
    return { mae: 0, differencePercent: 0 };
  }

  let totalDiff = 0;
  let significantDiffCount = 0;
  const threshold = 25; // Disparity threshold

  let diffCanvas: HTMLCanvasElement | null = null;
  let diffPixels: Uint8ClampedArray | null = null;

  if (generateDifferenceMap && typeof document !== 'undefined') {
    diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const ctx = diffCanvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      diffPixels = imgData.data;
    }
  }

  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    const maxChDiff = Math.max(rDiff, gDiff, bDiff);

    totalDiff += maxChDiff;
    if (maxChDiff > threshold) {
      significantDiffCount++;
    }

    if (diffPixels) {
      // Amplify difference map for visual inspection (3.5x gain)
      diffPixels[i] = Math.min(255, rDiff * 3.5);
      diffPixels[i + 1] = Math.min(255, gDiff * 3.5);
      diffPixels[i + 2] = Math.min(255, bDiff * 3.5);
      diffPixels[i + 3] = 255;
    }
  }

  let differenceMapDataUrl: string | undefined;
  if (diffCanvas && diffPixels) {
    const ctx = diffCanvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      imgData.data.set(diffPixels);
      ctx.putImageData(imgData, 0, 0);
      differenceMapDataUrl = diffCanvas.toDataURL('image/png');
    }
  }

  const mae = Number((totalDiff / pixelCount).toFixed(2));
  const differencePercent = Number(((significantDiffCount / pixelCount) * 100).toFixed(2));

  return { mae, differencePercent, differenceMapDataUrl };
}

/**
 * Computes a 64-bit dHash (difference hash) for fast visual similarity and duplicate detection
 */
export function calculatePerceptualHash(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): string {
  // Sample 9 horizontal x 8 vertical grid points
  const gridW = 9;
  const gridH = 8;
  const gray: number[][] = [];

  const stepX = Math.max(1, Math.floor(width / gridW));
  const stepY = Math.max(1, Math.floor(height / gridH));

  for (let y = 0; y < gridH; y++) {
    gray[y] = [];
    for (let x = 0; x < gridW; x++) {
      const px = Math.min(width - 1, x * stepX);
      const py = Math.min(height - 1, y * stepY);
      const idx = (py * width + px) * 4;
      const lum = Math.round(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
      gray[y][x] = lum;
    }
  }

  // 64 bits: compare gray[y][x] > gray[y][x+1]
  let hex = '';
  let currentNibble = 0;
  let bitCount = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const bit = gray[y][x] > gray[y][x + 1] ? 1 : 0;
      currentNibble = (currentNibble << 1) | bit;
      bitCount++;

      if (bitCount % 4 === 0) {
        hex += currentNibble.toString(16);
        currentNibble = 0;
      }
    }
  }

  return hex;
}

/**
 * Calculates Hamming distance (number of differing bits) between two 64-bit perceptual hashes
 */
export function computeHammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length || hashA.length !== 16) {
    return 64;
  }
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Detects scene cut events, abrupt visual changes, and repeated/duplicate frames
 */
export function detectSceneCutsAndAnomalies(frames: ExtractedFrame[]): FrameTamperingEvent[] {
  const events: FrameTamperingEvent[] = [];
  if (frames.length < 2) return events;

  // 1. Sequential frame comparisons
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];

    const dist = computeHammingDistance(prev.perceptualHash, curr.perceptualHash);

    // If perceptual difference is high (distance > 22 out of 64 bits)
    if (dist >= 24) {
      const isSevere = dist >= 32;
      events.push({
        id: `EVENT-CUT-${i}`,
        timestamp: curr.timestamp,
        formattedTimestamp: curr.formattedTimestamp,
        frameIndex: curr.frameIndex,
        method: 'Pixel Difference',
        metric: `Hash Distance: ${dist}/64 bits`,
        differencePercent: Number(((dist / 64) * 100).toFixed(1)),
        severity: isSevere ? 'suspicious' : 'low',
        explanation: isSevere
          ? `Significant visual boundary detected between ${prev.formattedTimestamp} and ${curr.formattedTimestamp}. Consistent with an abrupt scene cut, spliced sequence, or dropped interval.`
          : `Standard shot transition or camera pan identified between sampled intervals.`,
        frameDataUrl: curr.dataUrl,
        previousFrameDataUrl: prev.dataUrl,
      });
    }

    // Blackout / whiteout frame check
    if (curr.averageLuminance < 4) {
      events.push({
        id: `EVENT-BLACK-${i}`,
        timestamp: curr.timestamp,
        formattedTimestamp: curr.formattedTimestamp,
        frameIndex: curr.frameIndex,
        method: 'Histogram Divergence',
        metric: `Mean Luminance: ${curr.averageLuminance.toFixed(1)}/255`,
        differencePercent: 0,
        severity: 'low',
        explanation: `Near-total black frame observed at ${curr.formattedTimestamp}. Often indicates scene fade-out, leader padding, or dropped exposure.`,
        frameDataUrl: curr.dataUrl,
      });
    }
  }

  // 2. Non-adjacent Near-Duplicate Frame Check (e.g. video loop or frozen camera)
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 2; j < frames.length; j++) {
      const timeDiff = frames[j].timestamp - frames[i].timestamp;
      if (timeDiff >= 1.5) {
        const dist = computeHammingDistance(frames[i].perceptualHash, frames[j].perceptualHash);
        if (dist <= 2) {
          events.push({
            id: `EVENT-DUP-${i}-${j}`,
            timestamp: frames[j].timestamp,
            formattedTimestamp: frames[j].formattedTimestamp,
            frameIndex: frames[j].frameIndex,
            method: 'Near-Duplicate Frame',
            metric: `Hash Distance: ${dist} bits across ${timeDiff.toFixed(1)}s`,
            differencePercent: 0,
            severity: 'suspicious',
            explanation: `Near-identical visual frame reappears at ${frames[j].formattedTimestamp} matching earlier frame from ${frames[i].formattedTimestamp}. Candidate video loop, frozen frame segment, or repeated surveillance clip.`,
            frameDataUrl: frames[j].dataUrl,
            previousFrameDataUrl: frames[i].dataUrl,
          });
        }
      }
    }
  }

  return events;
}
