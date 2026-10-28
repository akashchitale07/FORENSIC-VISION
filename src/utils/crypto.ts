/**
 * Cryptographic and hashing utilities for digital evidence integrity.
 */

export async function computeFileHashes(buffer: ArrayBuffer): Promise<{ sha256: string; sha1: string }> {
  // Use WebCrypto API for standard, collision-resistant cryptographic digests
  const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha1Buffer = await crypto.subtle.digest('SHA-1', buffer);

  return {
    sha256: bufferToHex(sha256Buffer),
    sha1: bufferToHex(sha1Buffer),
  };
}

export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexParts: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexParts[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return hexParts.join('');
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function sanitizeFilename(name: string): string {
  if (!name) return 'evidence_file.bin';
  // Strip path traversal sequences like ../ and ..\ first, then illegal characters
  const sanitized = name
    .replace(/(?:\.\.[/\\])+/g, '')
    .replace(/[\/\?<>\\:\*\|":\x00-\x1f\x80-\x9f]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return sanitized.length > 0 ? sanitized.slice(0, 100) : 'evidence_file.bin';
}

export function calculateAspectRatio(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const ratioW = width / divisor;
  const ratioH = height / divisor;
  // If common standard ratio
  if (Math.abs(width / height - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(width / height - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(width / height - 3 / 2) < 0.02) return '3:2';
  if (Math.abs(width / height - 1) < 0.01) return '1:1';
  return `${ratioW}:${ratioH}`;
}
