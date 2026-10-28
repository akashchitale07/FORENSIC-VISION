import { BitPlaneAnalysis, AnomalySeverity } from '../types/forensics';

export function calculateBitPlaneEntropy(data: Uint8ClampedArray, plane: number, channelOffset: number): {
  entropy: number;
  onesCount: number;
  totalBits: number;
} {
  let ones = 0;
  let total = 0;
  const bitMask = 1 << plane;

  for (let i = channelOffset; i < data.length; i += 4) {
    if ((data[i] & bitMask) !== 0) {
      ones++;
    }
    total++;
  }

  const p1 = ones / total;
  const p0 = 1 - p1;

  let entropy = 0;
  if (p0 > 0) entropy -= p0 * Math.log2(p0);
  if (p1 > 0) entropy -= p1 * Math.log2(p1);

  return {
    entropy: Number(entropy.toFixed(4)),
    onesCount: ones,
    totalBits: total,
  };
}

export function extractBitPlanePixels(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  plane: number, // 0 to 7
  channel: 'red' | 'green' | 'blue' | 'all'
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);
  const bitMask = 1 << plane;

  for (let i = 0; i < source.length; i += 4) {
    let val = 0;
    if (channel === 'red') {
      val = (source[i] & bitMask) !== 0 ? 255 : 0;
      output[i] = val;
      output[i + 1] = 0;
      output[i + 2] = 0;
    } else if (channel === 'green') {
      val = (source[i + 1] & bitMask) !== 0 ? 255 : 0;
      output[i] = 0;
      output[i + 1] = val;
      output[i + 2] = 0;
    } else if (channel === 'blue') {
      val = (source[i + 2] & bitMask) !== 0 ? 255 : 0;
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = val;
    } else {
      // All channels combined
      const rBit = (source[i] & bitMask) !== 0 ? 1 : 0;
      const gBit = (source[i + 1] & bitMask) !== 0 ? 1 : 0;
      const bBit = (source[i + 2] & bitMask) !== 0 ? 1 : 0;
      val = (rBit ^ gBit ^ bBit) ? 255 : 0;
      output[i] = val;
      output[i + 1] = val;
      output[i + 2] = val;
    }
    output[i + 3] = 255; // Alpha
  }

  return output;
}

export function evaluateLsbStego(
  bitPlanes: BitPlaneAnalysis[]
): {
  averageLsbEntropy: number;
  assessment: string;
  severity: AnomalySeverity;
} {
  const lsbPlanes = bitPlanes.filter((p) => p.plane === 0);
  if (lsbPlanes.length === 0) {
    return {
      averageLsbEntropy: 0,
      assessment: 'No bit planes evaluated.',
      severity: 'benign',
    };
  }

  const avgEntropy =
    lsbPlanes.reduce((acc, p) => acc + p.entropy, 0) / lsbPlanes.length;

  // LSB entropy > 0.995 is an indicator of randomized/encrypted embedded data
  if (avgEntropy > 0.997) {
    return {
      averageLsbEntropy: Number(avgEntropy.toFixed(4)),
      assessment:
        'High LSB bit-plane randomness detected. Bit distribution approaches theoretical maximum entropy (1.000), consistent with pseudorandom or encrypted payload injection.',
      severity: 'suspicious',
    };
  } else if (avgEntropy > 0.985) {
    return {
      averageLsbEntropy: Number(avgEntropy.toFixed(4)),
      assessment:
        'Slightly elevated LSB entropy observed. Typical for high-noise camera sensors or mild compression dithering; further payload analysis recommended.',
      severity: 'low',
    };
  } else {
    return {
      averageLsbEntropy: Number(avgEntropy.toFixed(4)),
      assessment:
        'LSB bit-plane distribution exhibits standard sensor noise gradients and natural pixel correlation. No anomalous bit-injection detected by supported heuristic checks.',
      severity: 'benign',
    };
  }
}
