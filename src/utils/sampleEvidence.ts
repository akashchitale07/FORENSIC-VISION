/**
 * Pre-configured forensic evidence test cases.
 * Generates synthetic images with deterministic forensic artifacts for testing.
 */

export interface SampleEvidenceItem {
  id: string;
  title: string;
  filename: string;
  category: 'Authentic Photo' | 'Manipulated Composite' | 'Stego Payload' | 'Watermarked Media';
  description: string;
  expectedFindings: string[];
  generateBlob: () => Promise<File>;
}

export const SAMPLE_EVIDENCE_LIST: SampleEvidenceItem[] = [
  {
    id: 'sample-authentic',
    title: 'Evidence #FV-AUTH-01: Field Inspection (Authentic Capture)',
    filename: 'IMG_20261014_143022.jpg',
    category: 'Authentic Photo',
    description: 'Direct optical sensor capture with consistent error level gradients and standard EXIF camera telemetry.',
    expectedFindings: [
      'Uniform ELA response across surface',
      'EXIF metadata tags present (Canon EOS R5 / F2.8 / 1/250s)',
      'No appended trailing payload after EOI marker',
      'Natural LSB bit-plane noise gradient',
    ],
    generateBlob: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // Realistic sky & landscape gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 300);
      skyGrad.addColorStop(0, '#1E3A8A');
      skyGrad.addColorStop(1, '#93C5FD');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 640, 300);

      // Terrain
      const groundGrad = ctx.createLinearGradient(0, 300, 0, 480);
      groundGrad.addColorStop(0, '#15803D');
      groundGrad.addColorStop(1, '#064E3B');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 300, 640, 180);

      // Natural sensor noise
      const imgData = ctx.getImageData(0, 0, 640, 480);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (Math.random() - 0.5) * 8;
        d[i] = Math.max(0, Math.min(255, d[i] + noise));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
      );
      return new File([blob], 'IMG_20261014_143022.jpg', { type: 'image/jpeg' });
    },
  },
  {
    id: 'sample-manipulated',
    title: 'Evidence #FV-MANIP-02: Suspicious Document Composite',
    filename: 'contract_scan_tampered.jpg',
    category: 'Manipulated Composite',
    description: 'Document image with a spliced high-contrast patch causing distinct ELA disparity and mismatched compression.',
    expectedFindings: [
      'Pronounced localized ELA disparity cluster',
      'Mismatched error gradient around spliced stamp area',
      'Inconsistent edge quantization',
    ],
    generateBlob: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // White/light gray document base
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, 640, 480);

      // Background lines of text
      ctx.fillStyle = '#64748B';
      for (let y = 50; y < 420; y += 24) {
        ctx.fillRect(60, y, 520, 8);
      }

      // Convert to heavily compressed JPEG first (Base stage)
      const baseBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.45)
      );

      // Now draw back and paste an uncompressed, sharp modification
      const baseImg = await blobToImage(baseBlob);
      ctx.drawImage(baseImg, 0, 0);

      // Spliced patch in center-right
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(350, 160, 200, 100);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('VOID / MODIFIED', 360, 220);

      const finalBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95)
      );
      return new File([finalBlob], 'contract_scan_tampered.jpg', { type: 'image/jpeg' });
    },
  },
  {
    id: 'sample-stego',
    title: 'Evidence #FV-STEGO-03: Covert Transmission (Trailing Payload)',
    filename: 'satellite_recon_stego.jpg',
    category: 'Stego Payload',
    description: 'Image containing an appended binary payload after the JPEG EOI (0xFFD9) marker and elevated LSB entropy.',
    expectedFindings: [
      'Structural Anomaly: Trailing bytes detected past JPEG EOI marker',
      'Extracted payload header: "SECRET_PAYLOAD_FLAG: MISSION_OP_ALPHA"',
      'Elevated LSB bit-plane entropy',
    ],
    generateBlob: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // Cosmic / satellite look
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, 480, 480);

      // Celestial object
      const radGrad = ctx.createRadialGradient(240, 240, 30, 240, 240, 180);
      radGrad.addColorStop(0, '#06B6D4');
      radGrad.addColorStop(0.6, '#1E3A8A');
      radGrad.addColorStop(1, '#030712');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(240, 240, 180, 0, Math.PI * 2);
      ctx.fill();

      // High entropy LSB noise injection
      const imgData = ctx.getImageData(0, 0, 480, 480);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // Randomize LSB of all channels
        d[i] = (d[i] & ~1) | (Math.random() > 0.5 ? 1 : 0);
        d[i + 1] = (d[i + 1] & ~1) | (Math.random() > 0.5 ? 1 : 0);
        d[i + 2] = (d[i + 2] & ~1) | (Math.random() > 0.5 ? 1 : 0);
      }
      ctx.putImageData(imgData, 0, 0);

      const standardJpegBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
      );

      const arrayBuffer = await standardJpegBlob.arrayBuffer();

      // Append hidden payload after JPEG EOI marker!
      const secretText =
        'SECRET_PAYLOAD_FLAG: MISSION_OP_ALPHA [COVERT_CHANNEL_ID: 99420-X] Timestamp: 2026-10-27T19:40:00Z\n' +
        '--BEGIN ENCRYPTED PGP DUMP--\nmQENBF+1Z2YBCADv6l4P6K...\n--END ENCRYPTED PGP DUMP--';
      const secretBytes = new TextEncoder().encode(secretText);

      const combined = new Uint8Array(arrayBuffer.byteLength + secretBytes.byteLength);
      combined.set(new Uint8Array(arrayBuffer), 0);
      combined.set(secretBytes, arrayBuffer.byteLength);

      return new File([combined], 'satellite_recon_stego.jpg', { type: 'image/jpeg' });
    },
  },
  {
    id: 'sample-watermark',
    title: 'Evidence #FV-WM-04: Stock Asset with Overlay Badge',
    filename: 'stock_watermarked_media.jpg',
    category: 'Watermarked Media',
    description: 'Image featuring high-frequency semi-transparent corner logo stamp and copyright overlay.',
    expectedFindings: [
      'High-frequency edge cluster in Bottom-Right quadrant',
      'Watermark detector state: Potential Indicator / Detected',
      'Corroborating corner gradient variance',
    ],
    generateBlob: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;

      // Neutral backdrop
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Central graphic
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.strokeRect(180, 100, 280, 240);

      // Watermark in bottom right corner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('© FORENSIC STOCK', 380, 440);
      ctx.strokeRect(370, 410, 240, 45);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
      );
      return new File([blob], 'stock_watermarked_media.jpg', { type: 'image/jpeg' });
    },
  },
];

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Image decode error'));
    img.src = url;
  });
}
