/**
 * Low-level binary file structure parsing, magic number detection,
 * trailing byte anomaly detection, and Shannon entropy analysis.
 */

export interface BinaryStructureResult {
  detectedFormat: 'JPEG' | 'PNG' | 'WEBP' | 'TIFF' | 'UNKNOWN';
  mimeType: string;
  isValidSignature: boolean;
  shannonEntropy: number;
  hasTrailingData: boolean;
  trailingBytesCount: number;
  trailingDataHexPreview?: string;
  structuralAnomalies: string[];
  chunksOrMarkers: Array<{ name: string; offset: number; length?: number; info?: string }>;
}

/**
 * Calculates Shannon Entropy of a byte buffer.
 * Theoretical max for 8-bit bytes is 8.0 bits/byte.
 */
export function calculateShannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const frequencies = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    frequencies[bytes[i]]++;
  }

  let entropy = 0;
  const len = bytes.length;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / len;
      entropy -= p * Math.log2(p);
    }
  }
  return Number(entropy.toFixed(4));
}

/**
 * Inspects binary structure for JPEG, PNG, WebP, and TIFF.
 */
export function analyzeBinaryStructure(buffer: ArrayBuffer): BinaryStructureResult {
  const bytes = new Uint8Array(buffer);
  const anomalies: string[] = [];
  const markers: Array<{ name: string; offset: number; length?: number; info?: string }> = [];
  const entropy = calculateShannonEntropy(bytes);

  let detectedFormat: 'JPEG' | 'PNG' | 'WEBP' | 'TIFF' | 'UNKNOWN' = 'UNKNOWN';
  let mimeType = 'application/octet-stream';
  let isValidSignature = false;
  let hasTrailingData = false;
  let trailingBytesCount = 0;
  let trailingDataHexPreview: string | undefined;

  // 1. Signature Check
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedFormat = 'JPEG';
    mimeType = 'image/jpeg';
    isValidSignature = true;
  } else if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    detectedFormat = 'PNG';
    mimeType = 'image/png';
    isValidSignature = true;
  } else if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    detectedFormat = 'WEBP';
    mimeType = 'image/webp';
    isValidSignature = true;
  } else if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    detectedFormat = 'TIFF';
    mimeType = 'image/tiff';
    isValidSignature = true;
  }

  // 2. Format-specific deep structure inspection
  if (detectedFormat === 'JPEG') {
    markers.push({ name: 'SOI (Start of Image)', offset: 0, length: 2 });
    let pos = 2;
    let foundSOS = false;
    let foundEOI = -1;

    while (pos < bytes.length - 1) {
      if (bytes[pos] === 0xff) {
        const marker = bytes[pos + 1];

        // Standalone markers without length: RST0-RST7 (0xD0-0xD7), SOI (0xD8), EOI (0xD9)
        if (marker === 0xd9) {
          foundEOI = pos + 2;
          markers.push({ name: 'EOI (End of Image)', offset: pos, length: 2 });
          break;
        }

        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
          // Restart marker or escaped FF
          pos++;
          continue;
        }

        // Marker with length payload
        if (pos + 3 < bytes.length) {
          const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
          let markerName = `Marker 0x${marker.toString(16).toUpperCase()}`;

          if (marker === 0xe0) markerName = 'APP0 (JFIF)';
          else if (marker === 0xe1) markerName = 'APP1 (Exif/XMP)';
          else if (marker === 0xe2) markerName = 'APP2 (ICC Profile/FlashPix)';
          else if (marker === 0xed) markerName = 'APP13 (Photoshop IRB)';
          else if (marker === 0xee) markerName = 'APP14 (Adobe)';
          else if (marker === 0xdb) markerName = 'DQT (Quantization Table)';
          else if (marker === 0xc0) markerName = 'SOF0 (Baseline DCT)';
          else if (marker === 0xc2) markerName = 'SOF2 (Progressive DCT)';
          else if (marker === 0xc4) markerName = 'DHT (Huffman Table)';
          else if (marker === 0xda) {
            markerName = 'SOS (Start of Scan)';
            foundSOS = true;
          } else if (marker === 0xfe) markerName = 'COM (Comment)';

          markers.push({ name: markerName, offset: pos, length: length + 2 });

          if (foundSOS) {
            // After SOS is compressed entropy-coded image data until EOI
            // Search backwards from end or scan forward for EOI (0xFF 0xD9)
            let eoiSearch = pos + length + 2;
            let lastEoiPos = -1;
            while (eoiSearch < bytes.length - 1) {
              if (bytes[eoiSearch] === 0xff && bytes[eoiSearch + 1] === 0xd9) {
                lastEoiPos = eoiSearch;
                break;
              }
              eoiSearch++;
            }
            if (lastEoiPos !== -1) {
              foundEOI = lastEoiPos + 2;
              markers.push({ name: 'EOI (End of Image)', offset: lastEoiPos, length: 2 });
            }
            break;
          }

          pos += 2 + length;
        } else {
          pos++;
        }
      } else {
        pos++;
      }
    }

    if (foundEOI !== -1 && foundEOI < bytes.length) {
      hasTrailingData = true;
      trailingBytesCount = bytes.length - foundEOI;
      anomalies.push(`Detected ${trailingBytesCount} trailing bytes appended past official JPEG EOI marker.`);
      trailingDataHexPreview = formatHexPreview(bytes.slice(foundEOI, Math.min(foundEOI + 64, bytes.length)));
    } else if (foundEOI === -1) {
      anomalies.push('JPEG End-of-Image (EOI 0xFFD9) marker was not found; file stream may be truncated.');
    }
  } else if (detectedFormat === 'PNG') {
    let offset = 8;
    let foundIEND = false;

    while (offset + 8 <= bytes.length) {
      const length =
        (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      markers.push({ name: `Chunk: ${type}`, offset, length: length + 12 });

      if (type === 'IEND') {
        foundIEND = true;
        const endOfPng = offset + 12; // 4 len + 4 type + 0 data + 4 crc
        if (endOfPng < bytes.length) {
          hasTrailingData = true;
          trailingBytesCount = bytes.length - endOfPng;
          anomalies.push(`Detected ${trailingBytesCount} trailing bytes appended past PNG IEND chunk.`);
          trailingDataHexPreview = formatHexPreview(
            bytes.slice(endOfPng, Math.min(endOfPng + 64, bytes.length))
          );
        }
        break;
      }

      offset += 12 + length;
    }

    if (!foundIEND) {
      anomalies.push('PNG IEND chunk missing; possible file corruption or stream truncation.');
    }
  } else if (detectedFormat === 'WEBP') {
    if (bytes.length >= 8) {
      // RIFF header holds file size minus 8 bytes in little endian
      const riffPayloadSize =
        bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
      const expectedTotal = riffPayloadSize + 8;
      if (bytes.length > expectedTotal) {
        hasTrailingData = true;
        trailingBytesCount = bytes.length - expectedTotal;
        anomalies.push(`Detected ${trailingBytesCount} trailing bytes past RIFF container bounds.`);
        trailingDataHexPreview = formatHexPreview(
          bytes.slice(expectedTotal, Math.min(expectedTotal + 64, bytes.length))
        );
      }
    }
  }

  // Shannon entropy check
  if (entropy > 7.95) {
    anomalies.push(`Extremely high entropy (${entropy}/8.00): characteristic of encrypted payload or heavy steganographic embedding.`);
  }

  return {
    detectedFormat,
    mimeType,
    isValidSignature,
    shannonEntropy: entropy,
    hasTrailingData,
    trailingBytesCount,
    trailingDataHexPreview,
    structuralAnomalies: anomalies,
    chunksOrMarkers: markers,
  };
}

export function formatHexPreview(bytes: Uint8Array): string {
  let hex = '';
  let ascii = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
    const char = bytes[i];
    ascii += char >= 32 && char <= 126 ? String.fromCharCode(char) : '.';
    if ((i + 1) % 16 === 0) {
      hex += '  ' + ascii + '\n';
      ascii = '';
    }
  }
  if (ascii.length > 0) {
    const pad = '   '.repeat(16 - (bytes.length % 16));
    hex += pad + '  ' + ascii;
  }
  return hex.trim();
}
