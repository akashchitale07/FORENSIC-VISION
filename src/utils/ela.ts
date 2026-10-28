import { ElaResult, ElaSettings, AnomalySeverity } from '../types/forensics';

export async function performErrorLevelAnalysis(
  sourceImage: HTMLImageElement,
  settings: ElaSettings = { jpegQuality: 85, scaleMultiplier: 20 }
): Promise<ElaResult> {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  // 1. Create source canvas to get original pixels
  const origCanvas = document.createElement('canvas');
  origCanvas.width = width;
  origCanvas.height = height;
  const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
  if (!origCtx) throw new Error('Canvas 2D context not available');

  origCtx.drawImage(sourceImage, 0, 0);
  const origData = origCtx.getImageData(0, 0, width, height).data;

  // 2. Re-compress image to JPEG at specified quality
  const quality = Math.max(0.1, Math.min(1.0, settings.jpegQuality / 100));
  const resavedDataUrl = origCanvas.toDataURL('image/jpeg', quality);

  // 3. Load re-saved JPEG into temporary image
  const resavedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode recompressed JPEG'));
    img.src = resavedDataUrl;
  });

  // 4. Render re-saved image to compare
  const resavedCanvas = document.createElement('canvas');
  resavedCanvas.width = width;
  resavedCanvas.height = height;
  const resavedCtx = resavedCanvas.getContext('2d', { willReadFrequently: true });
  if (!resavedCtx) throw new Error('Canvas 2D context not available');

  resavedCtx.drawImage(resavedImg, 0, 0);
  const resavedData = resavedCtx.getImageData(0, 0, width, height).data;

  // 5. Compute ELA difference map
  const elaCanvas = document.createElement('canvas');
  elaCanvas.width = width;
  elaCanvas.height = height;
  const elaCtx = elaCanvas.getContext('2d');
  if (!elaCtx) throw new Error('Canvas 2D context not available');

  const elaImageData = elaCtx.createImageData(width, height);
  const elaPixels = elaImageData.data;

  let totalDisparity = 0;
  let maxDisparity = 0;
  let highDisparityCount = 0;
  const pixelCount = width * height;
  const scale = settings.scaleMultiplier;

  for (let i = 0; i < origData.length; i += 4) {
    const diffR = Math.abs(origData[i] - resavedData[i]);
    const diffG = Math.abs(origData[i + 1] - resavedData[i + 1]);
    const diffB = Math.abs(origData[i + 2] - resavedData[i + 2]);

    const pixelDisparity = Math.max(diffR, diffG, diffB);
    totalDisparity += pixelDisparity;
    if (pixelDisparity > maxDisparity) maxDisparity = pixelDisparity;

    // Disparity threshold for anomaly detection
    if (pixelDisparity > 18) {
      highDisparityCount++;
    }

    // Scale difference for visualization
    elaPixels[i] = Math.min(255, diffR * scale);
    elaPixels[i + 1] = Math.min(255, diffG * scale);
    elaPixels[i + 2] = Math.min(255, diffB * scale);
    elaPixels[i + 3] = 255;
  }

  elaCtx.putImageData(elaImageData, 0, 0);

  const averageDisparity = Number((totalDisparity / pixelCount).toFixed(2));
  const highDisparityRatio = Number(((highDisparityCount / pixelCount) * 100).toFixed(2));

  // Determine severity and assessment
  let severity: AnomalySeverity = 'benign';
  let assessment = 'Uniform error distribution. No signs of multi-generation JPEG splicing detected.';
  const notes: string[] = [
    `Recompression test performed at JPEG quality ${settings.jpegQuality}% with ${settings.scaleMultiplier}x visualization gain.`,
  ];

  if (highDisparityRatio > 8 || (averageDisparity > 7.0 && maxDisparity > 30)) {
    severity = 'tampered';
    assessment =
      'Significant localized disparity clusters detected. Substantial localized variance in JPEG compression error levels indicates probable composite insertion or localized resaving.';
    notes.push('Regions with much brighter ELA response than surrounding areas suggest recent modifications or pasted elements with different compression histories.');
  } else if (maxDisparity > 35 && highDisparityRatio > 0.1) {
    severity = 'suspicious';
    assessment =
      'Localized high-disparity anomaly detected. Concentrated peak error (max disparity > 35) indicates localized patch modification, spliced text/stamp, or sharp contrast boundary.';
    notes.push('Examine bright ELA clusters to determine whether they correlate with spliced text, stamps, or localized modifications.');
  } else if (highDisparityRatio > 3 || averageDisparity > 4.5) {
    severity = 'suspicious';
    assessment =
      'Moderate localized error level divergence observed. Possible localized touch-up, filtering, or sharp contrast boundary artifact.';
    notes.push('Check whether bright ELA areas align with natural high-frequency edges or isolated subject matter boundaries.');
  } else {
    severity = 'benign';
    assessment =
      'Consistent error dissipation across uniform textures and edges. Typical single-generation compression signature.';
    notes.push('Consistent error level indicates uniform compression history throughout the image plane.');
  }

  notes.push(
    'Forensic Note: High-contrast edges naturally exhibit higher DCT quantization noise. ELA alone does not confirm manipulation; findings must be corroborated with metadata and structural analysis.'
  );

  return {
    elaDataUrl: elaCanvas.toDataURL('image/png'),
    averageDisparity,
    maxDisparity,
    highDisparityRatio,
    assessment,
    severity,
    notes,
  };
}
