import { HistogramAnalysis, HistogramChannel } from '../types/forensics';

export function calculateHistogramFromPixels(
  data: Uint8ClampedArray,
  pixelCount: number
): HistogramAnalysis {
  const rBins = new Uint32Array(256);
  const gBins = new Uint32Array(256);
  const bBins = new Uint32Array(256);
  const lumBins = new Uint32Array(256);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumSum = 0;

  let rMin = 255, rMax = 0;
  let gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0;
  let lumMin = 255, lumMax = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    rBins[r]++;
    gBins[g]++;
    bBins[b]++;
    lumBins[lum]++;

    rSum += r;
    gSum += g;
    bSum += b;
    lumSum += lum;

    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
    if (lum < lumMin) lumMin = lum;
    if (lum > lumMax) lumMax = lum;
  }

  const rMean = rSum / pixelCount;
  const gMean = gSum / pixelCount;
  const bMean = bSum / pixelCount;
  const lumMean = lumSum / pixelCount;

  // Standard deviations
  let rVarSum = 0, gVarSum = 0, bVarSum = 0, lumVarSum = 0;
  for (let i = 0; i < 256; i++) {
    if (rBins[i] > 0) rVarSum += rBins[i] * Math.pow(i - rMean, 2);
    if (gBins[i] > 0) gVarSum += gBins[i] * Math.pow(i - gMean, 2);
    if (bBins[i] > 0) bVarSum += bBins[i] * Math.pow(i - bMean, 2);
    if (lumBins[i] > 0) lumVarSum += lumBins[i] * Math.pow(i - lumMean, 2);
  }

  const buildChannel = (
    bins: Uint32Array,
    min: number,
    max: number,
    mean: number,
    varSum: number
  ): HistogramChannel => ({
    data: Array.from(bins),
    min,
    max,
    mean: Number(mean.toFixed(2)),
    stdDev: Number(Math.sqrt(varSum / pixelCount).toFixed(2)),
    clippedDarkPercent: Number(((bins[0] / pixelCount) * 100).toFixed(2)),
    clippedLightPercent: Number(((bins[255] / pixelCount) * 100).toFixed(2)),
  });

  // Calculate tonal entropy of luminance
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (lumBins[i] > 0) {
      const p = lumBins[i] / pixelCount;
      entropy -= p * Math.log2(p);
    }
  }

  const dynamicRangePercent = Number(
    (((lumMax - lumMin) / 255) * 100).toFixed(1)
  );

  return {
    red: buildChannel(rBins, rMin, rMax, rMean, rVarSum),
    green: buildChannel(gBins, gMin, gMax, gMean, gVarSum),
    blue: buildChannel(bBins, bMin, bMax, bMean, bVarSum),
    luminance: buildChannel(lumBins, lumMin, lumMax, lumMean, lumVarSum),
    dynamicRangePercent,
    entropy: Number(entropy.toFixed(3)),
  };
}
