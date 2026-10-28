import { MetadataEntry, WatermarkDetectionResult } from '../types/forensics';

export function analyzeWatermarks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  metadata: MetadataEntry[]
): WatermarkDetectionResult {
  const findings: string[] = [];
  const textSignatures: string[] = [];
  const aiSignatures: string[] = [];
  let candidateAreasCount = 0;

  // 1. Metadata inspection for AI generation, provenance, and stock watermark markers
  const knownStockKeywords = ['watermark', 'shutterstock', 'gettyimages', 'istock', 'adobe stock', 'alamy', 'depositphotos', 'dreamstime', 'preview'];
  const knownAiKeywords = ['midjourney', 'dall-e', 'dalle', 'stable diffusion', 'comfyui', 'c2pa', 'synthid', 'deepmind', 'firefly', 'novelai', 'automatic1111'];

  for (const entry of metadata) {
    const val = (entry.value || '').toLowerCase();
    const tag = (entry.tag || '').toLowerCase();

    for (const kw of knownStockKeywords) {
      if (val.includes(kw) || tag.includes(kw)) {
        textSignatures.push(`Metadata flag: ${entry.tag} contains "${kw}"`);
        findings.push(`Stock/Watermark keyword "${kw}" identified in metadata field ${entry.tag}.`);
      }
    }

    for (const aiKw of knownAiKeywords) {
      if (val.includes(aiKw) || tag.includes(aiKw)) {
        aiSignatures.push(`AI Provenance tag: ${entry.tag} contains "${aiKw}"`);
        findings.push(`Synthetic media / AI signature "${aiKw}" matched in metadata (${entry.tag}).`);
      }
    }
  }

  // 2. Corner and Perimeter High-Frequency Variance Analysis
  // Watermarks, badges, and logos are typically located in the 4 corner zones or along the bottom/top borders
  const cornerWidth = Math.min(Math.floor(width * 0.25), 150);
  const cornerHeight = Math.min(Math.floor(height * 0.25), 150);

  const checkRegionHighFrequency = (
    startX: number,
    startY: number,
    w: number,
    h: number
  ): { variance: number; edgeCount: number } => {
    let edgeCount = 0;
    let sumDiff = 0;
    let samples = 0;

    for (let y = startY; y < startY + h - 1; y += 2) {
      for (let x = startX; x < startX + w - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const downIdx = ((y + 1) * width + x) * 4;

        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        const rightLum = 0.299 * pixels[rightIdx] + 0.587 * pixels[rightIdx + 1] + 0.114 * pixels[rightIdx + 2];
        const downLum = 0.299 * pixels[downIdx] + 0.587 * pixels[downIdx + 1] + 0.114 * pixels[downIdx + 2];

        const grad = Math.abs(lum - rightLum) + Math.abs(lum - downLum);
        sumDiff += grad;
        samples++;

        // High contrast edge threshold
        if (grad > 45) {
          edgeCount++;
        }
      }
    }

    return {
      variance: samples > 0 ? sumDiff / samples : 0,
      edgeCount,
    };
  };

  const corners = [
    { name: 'Top-Left', x: 0, y: 0 },
    { name: 'Top-Right', x: Math.max(0, width - cornerWidth), y: 0 },
    { name: 'Bottom-Left', x: 0, y: Math.max(0, height - cornerHeight) },
    { name: 'Bottom-Right', x: Math.max(0, width - cornerWidth), y: Math.max(0, height - cornerHeight) },
  ];

  for (const c of corners) {
    const res = checkRegionHighFrequency(c.x, c.y, cornerWidth, cornerHeight);
    // If a corner exhibits an unusually dense cluster of high-frequency edges
    if (res.edgeCount > (cornerWidth * cornerHeight) * 0.12 && res.variance > 25) {
      candidateAreasCount++;
      findings.push(`Localized high-frequency edge cluster detected in ${c.name} quadrant (candidate logo/overlay zone).`);
    }
  }

  // 3. Status Determination
  let status: 'Detected' | 'Potential Indicator' | 'Not Detected by Supported Checks' | 'Inconclusive' =
    'Not Detected by Supported Checks';
  let confidence = 15;

  if (textSignatures.length > 0 || aiSignatures.length > 0) {
    status = 'Detected';
    confidence = 90;
  } else if (candidateAreasCount >= 2) {
    status = 'Potential Indicator';
    confidence = 65;
  } else if (candidateAreasCount === 1) {
    status = 'Potential Indicator';
    confidence = 45;
  } else {
    status = 'Not Detected by Supported Checks';
    confidence = 20;
    findings.push('No visible watermark overlays, repetitive corner stamps, or known watermark metadata signatures found by supported heuristic routines.');
  }

  const limitations =
    'Watermark detection checks only inspect supported metadata tags and spatial high-frequency edge heuristics. Invisible, spread-spectrum, or neural watermarks (e.g. SynthID, proprietary DWT watermarking) require proprietary algorithmic keys or reference carrier images and cannot be identified by generic visual analysis.';

  return {
    status,
    confidence,
    candidateAreasCount,
    detectedTextSignatures: textSignatures,
    aiModelSignatures: aiSignatures,
    findings,
    limitations,
  };
}
