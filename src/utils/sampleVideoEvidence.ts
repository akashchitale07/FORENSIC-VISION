/**
 * Pre-configured forensic video test evidence generator.
 * Produces real, decodable in-browser WebM video streams using Canvas and MediaRecorder.
 */

export interface SampleVideoItem {
  id: string;
  title: string;
  filename: string;
  category: 'Continuous Surveillance' | 'Spliced / Edited Cut' | 'Watermarked Broadcast';
  description: string;
  expectedFindings: string[];
  generateBlob: () => Promise<File>;
}

export const SAMPLE_VIDEO_LIST: SampleVideoItem[] = [
  {
    id: 'sample-video-surveillance',
    title: 'Evidence #FV-VID-01: Continuous Surveillance Stream',
    filename: 'surveillance_cam04_raw.webm',
    category: 'Continuous Surveillance',
    description: 'Unbroken optical surveillance feed with continuous frame counter and steady motion vectors.',
    expectedFindings: [
      'Consistent frame-to-frame difference (< 15%)',
      'Continuous temporal sequence without abrupt cuts',
      'Standard WebM container structure',
      'No repeated duplicate frame freezes',
    ],
    generateBlob: async () => {
      return generateSyntheticVideo({
        type: 'surveillance',
        durationSec: 3.5,
        filename: 'surveillance_cam04_raw.webm',
      });
    },
  },
  {
    id: 'sample-video-spliced',
    title: 'Evidence #FV-VID-02: Spliced CCTV Sequence (Abrupt Scene Cut)',
    filename: 'cctv_spliced_tampered.webm',
    category: 'Spliced / Edited Cut',
    description: 'Video sequence containing an abrupt mid-stream scene transition and spliced segment at timestamp 00:01.800.',
    expectedFindings: [
      'Abrupt visual transition / scene cut detected at ~00:01.800',
      'Pixel difference spike > 40%',
      'Flagged as Potential Indicator / Suspicious edit',
    ],
    generateBlob: async () => {
      return generateSyntheticVideo({
        type: 'spliced',
        durationSec: 3.5,
        filename: 'cctv_spliced_tampered.webm',
      });
    },
  },
  {
    id: 'sample-video-watermark',
    title: 'Evidence #FV-VID-03: Broadcast Feed with Persistent Corner Overlay',
    filename: 'broadcast_stream_watermarked.webm',
    category: 'Watermarked Broadcast',
    description: 'Video stream featuring a persistent semi-transparent watermark logo in the bottom-right corner.',
    expectedFindings: [
      'Persistent corner edge variance detected across sampled frames',
      'Watermark detector state: Potential Indicator / Detected',
      'Standard broadcast cadence',
    ],
    generateBlob: async () => {
      return generateSyntheticVideo({
        type: 'watermarked',
        durationSec: 3.5,
        filename: 'broadcast_stream_watermarked.webm',
      });
    },
  },
];

interface SyntheticOptions {
  type: 'surveillance' | 'spliced' | 'watermarked';
  durationSec: number;
  filename: string;
}

async function generateSyntheticVideo(options: SyntheticOptions): Promise<File> {
  const width = 480;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(25); // 25 fps
  let mimeType = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1000000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingFinished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start(100);

  const fps = 25;
  const totalFrames = Math.floor(options.durationSec * fps);
  let frame = 0;

  const interval = setInterval(() => {
    const elapsedSec = frame / fps;

    // Draw frame based on type
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    if (options.type === 'spliced' && elapsedSec >= 1.6 && elapsedSec <= 2.4) {
      // Spliced red warning screen
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#FEF2F2';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('INJECTED SPLICED SEGMENT', 50, 180);
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '16px monospace';
      ctx.fillText(`ANOMALY TIMECODE: ${elapsedSec.toFixed(3)}s`, 50, 220);
    } else {
      // Normal surveillance backdrop
      const gridOffset = (frame * 3) % 40;
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      for (let x = gridOffset; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Moving target box
      const boxX = 60 + ((frame * 6) % (width - 160));
      const boxY = 120 + Math.sin(frame * 0.1) * 30;
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(boxX, boxY, 50, 50);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`CAM-04 // LIVE RECORDER`, 24, 36);
      ctx.font = '14px monospace';
      ctx.fillText(`T: ${elapsedSec.toFixed(3)}s  FRAME: ${frame}`, 24, 60);

      // Watermark badge if requested
      if (options.type === 'watermarked') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('© FORENSIC STREAM TV', width - 230, height - 20);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(width - 240, height - 38, 225, 26);
      }
    }

    frame++;
    if (frame >= totalFrames) {
      clearInterval(interval);
      recorder.stop();
    }
  }, 1000 / fps);

  const blob = await recordingFinished;
  return new File([blob], options.filename, { type: 'video/webm' });
}
