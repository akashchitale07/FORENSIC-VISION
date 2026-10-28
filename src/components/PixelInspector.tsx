import React, { useState, useRef, useEffect } from 'react';
import { Crosshair, Eye } from 'lucide-react';

interface PixelInspectorProps {
  imageSrc: string;
  naturalWidth: number;
  naturalHeight: number;
}

export const PixelInspector: React.FC<PixelInspectorProps> = ({
  imageSrc,
  naturalWidth,
  naturalHeight,
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [pixelColor, setPixelColor] = useState<{
    r: number;
    g: number;
    b: number;
    hex: string;
    lum: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize hidden canvas to sample colors accurately
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      hiddenCanvasRef.current = canvas;
    };
    img.src = imageSrc;
  }, [imageSrc, naturalWidth, naturalHeight]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !hiddenCanvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const imgX = Math.floor(Math.max(0, Math.min(naturalWidth - 1, clientX * scaleX)));
    const imgY = Math.floor(Math.max(0, Math.min(naturalHeight - 1, clientY * scaleY)));

    setCoords({ x: imgX, y: imgY });

    const ctx = hiddenCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const pixel = ctx.getImageData(imgX, imgY, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    setPixelColor({ r, g, b, hex, lum });

    // Render zoomed loupe grid
    renderLoupe(imgX, imgY);
  };

  const renderLoupe = (centerX: number, centerY: number) => {
    if (!loupeCanvasRef.current || !hiddenCanvasRef.current) return;
    const loupeCtx = loupeCanvasRef.current.getContext('2d');
    if (!loupeCtx) return;

    loupeCtx.imageSmoothingEnabled = false;

    // Sample an 11x11 window around cursor
    const sampleSize = 11;
    const half = Math.floor(sampleSize / 2);
    const startX = Math.max(0, Math.min(naturalWidth - sampleSize, centerX - half));
    const startY = Math.max(0, Math.min(naturalHeight - sampleSize, centerY - half));

    loupeCtx.clearRect(0, 0, 132, 132);

    loupeCtx.drawImage(
      hiddenCanvasRef.current,
      startX,
      startY,
      sampleSize,
      sampleSize,
      0,
      0,
      132,
      132
    );

    // Draw pixel grid overlay
    loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    loupeCtx.lineWidth = 1;
    const cellSize = 132 / sampleSize;
    for (let i = 0; i <= sampleSize; i++) {
      loupeCtx.beginPath();
      loupeCtx.moveTo(i * cellSize, 0);
      loupeCtx.lineTo(i * cellSize, 132);
      loupeCtx.stroke();

      loupeCtx.beginPath();
      loupeCtx.moveTo(0, i * cellSize);
      loupeCtx.lineTo(132, i * cellSize);
      loupeCtx.stroke();
    }

    // Target crosshair box in center
    loupeCtx.strokeStyle = '#06B6D4';
    loupeCtx.lineWidth = 2;
    loupeCtx.strokeRect(half * cellSize, half * cellSize, cellSize, cellSize);
  };

  return (
    <div className="space-y-3">
      {/* Interactive Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setCoords(null);
          setPixelColor(null);
        }}
        className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center cursor-crosshair select-none group"
        style={{ minHeight: '360px', maxHeight: '550px' }}
      >
        <img
          src={imageSrc}
          alt="Pixel Inspection Subject"
          className="max-h-[500px] w-auto object-contain mx-auto pointer-events-none"
        />

        {/* Loupe Floating Window */}
        {coords && pixelColor && (
          <div className="absolute bottom-3 right-3 p-3 rounded-lg bg-slate-950/95 border border-cyan-500/50 shadow-[0_10px_25px_rgba(0,0,0,0.8)] backdrop-blur-md pointer-events-none flex items-center gap-3 font-mono">
            <canvas
              ref={loupeCanvasRef}
              width={132}
              height={132}
              className="w-[110px] h-[110px] rounded border border-slate-800 shadow-inner bg-black"
            />

            <div className="text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
                <Crosshair className="w-3.5 h-3.5" />
                <span>Pixel ({coords.x}, {coords.y})</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded border border-white/20 inline-block"
                  style={{ backgroundColor: pixelColor.hex }}
                />
                <span className="text-slate-200 font-semibold">{pixelColor.hex}</span>
              </div>
              <div className="text-slate-400">
                RGB: ({pixelColor.r}, {pixelColor.g}, {pixelColor.b})
              </div>
              <div className="text-slate-400">
                Luminance: {pixelColor.lum} / 255
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>Hover over image for real-time 11x sub-pixel loupe & RGB analysis</span>
        </div>
        <span>Dimensions: {naturalWidth} × {naturalHeight} px</span>
      </div>
    </div>
  );
};
