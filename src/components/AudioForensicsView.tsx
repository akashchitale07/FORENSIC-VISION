import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Scissors,
  Download,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  Copy,
  Zap,
  Activity,
  Layers,
  FileCode,
  Waveform as WaveformIcon,
  ShieldAlert,
  Mic,
  Clock,
  ExternalLink,
  ChevronRight,
  Sliders,
  AudioWaveform,
} from 'lucide-react';
import {
  AudioForensicSession,
  AudioAnomalyMarker,
  AudioDerivative,
} from '../types/forensics';
import {
  formatAudioTimestamp,
  generateSpectrogramData,
  encodeWavDerivative,
  computeAudioHashes,
} from '../utils/audioEngine';

interface AudioForensicsViewProps {
  session: AudioForensicSession | null;
  onOpenUpload: () => void;
  onAddDerivative?: (derivative: AudioDerivative) => void;
}

export const AudioForensicsView: React.FC<AudioForensicsViewProps> = ({
  session,
  onOpenUpload,
  onAddDerivative,
}) => {
  const [activeTab, setActiveTab] = useState<
    'player' | 'spectrogram' | 'anomalies' | 'container' | 'enf' | 'derivatives'
  >('player');

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);

  // Time Range Selection for Region Audition & Derivative Export
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Spectrogram settings
  const [fftSize, setFftSize] = useState<256 | 512 | 1024 | 2048>(512);
  const [useLogScale, setUseLogScale] = useState(false);

  // Derivative Export modal/state
  const [isExportingDerivative, setIsExportingDerivative] = useState(false);
  const [derivativeNotes, setDerivativeNotes] = useState('');
  const [derivativesList, setDerivativesList] = useState<AudioDerivative[]>(
    session?.derivatives || []
  );

  // Copy hash state
  const [copiedSha256, setCopiedSha256] = useState(false);
  const [copiedSha1, setCopiedSha1] = useState(false);

  // References
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync session derivatives
  useEffect(() => {
    if (session) {
      setDerivativesList(session.derivatives || []);
      setCurrentTime(0);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [session?.id]);

  // Handle Play/Pause/Stop
  const togglePlay = () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (selectionStart !== null && selectionEnd !== null) {
        if (audio.currentTime < selectionStart || audio.currentTime >= selectionEnd) {
          audio.currentTime = selectionStart;
        }
      }
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = selectionStart !== null ? selectionStart : 0;
    setCurrentTime(audio.currentTime);
    setIsPlaying(false);
  };

  const handleSeek = (time: number) => {
    const audio = audioElementRef.current;
    if (!audio || !session) return;
    const clamped = Math.max(0, Math.min(session.metrics.duration, time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // Time update listener
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio || !session) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Loop range constraint
      if (selectionStart !== null && selectionEnd !== null) {
        if (audio.currentTime >= selectionEnd) {
          if (isLooping) {
            audio.currentTime = selectionStart;
          } else {
            audio.pause();
            setIsPlaying(false);
            audio.currentTime = selectionStart;
          }
        }
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [session, selectionStart, selectionEnd, isLooping]);

  // Volume & rate changes
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = isMuted ? 0 : volume;
      audioElementRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  // Draw Waveform on Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !session?.audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Center baseline
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const buffer = session.audioBuffer;
    const channelData = buffer.getChannelData(0);
    const duration = buffer.duration;
    const step = Math.ceil(channelData.length / width);
    const ampScale = (height / 2) * 0.95;

    // Draw Amplitude Waveform (Cyan glow)
    ctx.fillStyle = '#06b6d4';
    for (let x = 0; x < width; x++) {
      let min = 1.0;
      let max = -1.0;
      const start = x * step;
      const end = Math.min(channelData.length, start + step);

      for (let i = start; i < end; i++) {
        const val = channelData[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      const yTop = height / 2 - max * ampScale;
      const yBottom = height / 2 - min * ampScale;
      const barHeight = Math.max(1, yBottom - yTop);

      ctx.fillRect(x, yTop, 1, barHeight);
    }

    // Draw Selected Region Overlay
    if (selectionStart !== null && selectionEnd !== null && duration > 0) {
      const xStart = (selectionStart / duration) * width;
      const xEnd = (selectionEnd / duration) * width;
      const selWidth = Math.max(2, xEnd - xStart);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.fillRect(xStart, 0, selWidth, height);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xStart, 0, selWidth, height);
    }

    // Draw Anomaly Markers on Waveform
    session.anomalies.forEach((anom) => {
      if (anom.timestamp > 0 && duration > 0) {
        const xAnom = (anom.timestamp / duration) * width;
        ctx.strokeStyle =
          anom.category === 'Suspicious'
            ? '#ef4444'
            : anom.category === 'Potential Indicator'
            ? '#f59e0b'
            : '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xAnom, 0);
        ctx.lineTo(xAnom, height);
        ctx.stroke();

        // Flag triangle
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(xAnom, 0);
        ctx.lineTo(xAnom + 6, 0);
        ctx.lineTo(xAnom, 8);
        ctx.fill();
      }
    });

    // Draw Playhead cursor
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(playheadX, 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [session, currentTime, selectionStart, selectionEnd]);

  // Draw Spectrogram Canvas
  useEffect(() => {
    if (activeTab !== 'spectrogram' || !session?.audioBuffer) return;
    const canvas = spectrogramCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spectroData = generateSpectrogramData(session.audioBuffer, fftSize, 600);
    const { columns, binCount } = spectroData;
    const numCols = columns.length;
    if (numCols === 0) return;

    canvas.width = numCols;
    canvas.height = binCount;

    const imgData = ctx.createImageData(numCols, binCount);
    const data = imgData.data;

    // Colormap mapping (0..1 magnitude -> Deep Navy to Cyan to Violet to Red/Orange)
    for (let x = 0; x < numCols; x++) {
      const col = columns[x];
      for (let y = 0; y < binCount; y++) {
        // Invert Y so 0 Hz is at bottom, Nyquist is at top
        const binIndex = useLogScale
          ? Math.floor(Math.pow(y / binCount, 1.8) * binCount)
          : y;
        const normY = binCount - 1 - y;
        const val = col[Math.min(binCount - 1, binIndex)] || 0;

        const pixelIdx = (normY * numCols + x) * 4;

        // Custom forensic heatmap gradient:
        let r = 0, g = 0, b = 0;
        if (val < 0.25) {
          // 0.00..0.25: dark blue to deep cyan
          const t = val / 0.25;
          r = Math.floor(6 + t * 4);
          g = Math.floor(18 + t * 90);
          b = Math.floor(40 + t * 150);
        } else if (val < 0.6) {
          // 0.25..0.60: cyan to bright violet
          const t = (val - 0.25) / 0.35;
          r = Math.floor(10 + t * 150);
          g = Math.floor(108 - t * 40);
          b = Math.floor(190 + t * 65);
        } else if (val < 0.85) {
          // 0.60..0.85: violet to orange
          const t = (val - 0.6) / 0.25;
          r = Math.floor(160 + t * 85);
          g = Math.floor(68 + t * 80);
          b = Math.floor(255 - t * 200);
        } else {
          // 0.85..1.00: orange to yellow/white
          const t = (val - 0.85) / 0.15;
          r = 255;
          g = Math.floor(148 + t * 107);
          b = Math.floor(55 + t * 200);
        }

        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [session, activeTab, fftSize, useLogScale]);

  // Handle Waveform Drag / Range Selection
  const handleWaveformMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!session || !waveformCanvasRef.current) return;
    const rect = waveformCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const clickTime = (x / rect.width) * session.metrics.duration;

    setIsSelecting(true);
    setSelectionStart(clickTime);
    setSelectionEnd(clickTime);
    handleSeek(clickTime);
  };

  const handleWaveformMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !session || !waveformCanvasRef.current) return;
    const rect = waveformCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const moveTime = (x / rect.width) * session.metrics.duration;
    setSelectionEnd(moveTime);
  };

  const handleWaveformMouseUp = () => {
    setIsSelecting(false);
    if (selectionStart !== null && selectionEnd !== null) {
      if (Math.abs(selectionEnd - selectionStart) < 0.05) {
        // Bare click, not a range
        setSelectionStart(null);
        setSelectionEnd(null);
      } else if (selectionStart > selectionEnd) {
        // Swap if dragged backwards
        const temp = selectionStart;
        setSelectionStart(selectionEnd);
        setSelectionEnd(temp);
      }
    }
  };

  // Jump to specific anomaly timestamp
  const handleJumpToAnomaly = (timestamp: number) => {
    handleSeek(timestamp);
    if (!isPlaying) {
      togglePlay();
    }
  };

  // Audition A/B around an anomaly (500ms before vs 500ms after)
  const handleAuditionAB = (timestamp: number) => {
    const start = Math.max(0, timestamp - 0.5);
    const end = Math.min(session?.metrics.duration || 0, timestamp + 0.5);
    setSelectionStart(start);
    setSelectionEnd(end);
    handleSeek(start);
    const audio = audioElementRef.current;
    if (audio) {
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // Derivative WAV Generation & Download
  const handleExportWavDerivative = async () => {
    if (!session?.audioBuffer) return;
    setIsExportingDerivative(true);

    const start = selectionStart !== null ? selectionStart : 0;
    const end = selectionEnd !== null ? selectionEnd : session.metrics.duration;

    const { blob, buffer } = encodeWavDerivative(session.audioBuffer, start, end);
    const { sha256, sha1 } = await computeAudioHashes(buffer);
    const blobUrl = URL.createObjectURL(blob);

    const derivative: AudioDerivative = {
      id: `DERIV-${Date.now().toString(36).toUpperCase()}`,
      filename: `${session.integrity.filename.replace(/\.[^/.]+$/, '')}_cut_${formatAudioTimestamp(start).replace(/:/g, '-')}_to_${formatAudioTimestamp(end).replace(/:/g, '-')}.wav`,
      derivedAt: new Date().toISOString(),
      startTime: Number(start.toFixed(3)),
      endTime: Number(end.toFixed(3)),
      formattedTimeRange: `${formatAudioTimestamp(start)} - ${formatAudioTimestamp(end)}`,
      duration: Number((end - start).toFixed(3)),
      sha256,
      sha1,
      fileSize: blob.size,
      sampleRate: session.metrics.sampleRate,
      channels: session.metrics.channels,
      format: 'WAV (16-bit PCM)',
      blobUrl,
    };

    setDerivativesList((prev) => [derivative, ...prev]);
    onAddDerivative?.(derivative);

    // Trigger instant browser download
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = derivative.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setIsExportingDerivative(false);
  };

  const copyToClipboard = (text: string, type: 'sha256' | 'sha1') => {
    navigator.clipboard.writeText(text);
    if (type === 'sha256') {
      setCopiedSha256(true);
      setTimeout(() => setCopiedSha256(false), 2000);
    } else {
      setCopiedSha1(true);
      setTimeout(() => setCopiedSha1(false), 2000);
    }
  };

  if (!session) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto mb-4">
          <Mic className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 font-mono mb-2">
          No Audio Evidence Loaded
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6 font-mono">
          Upload an audio file (WAV, MP3, M4A, FLAC, OGG, WebM) or load a forensic test sample to begin signal inspection, spectrogram analysis, and splice detection.
        </p>
        <button
          onClick={onOpenUpload}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-mono font-bold transition shadow-sm cursor-pointer"
        >
          Load Audio Evidence
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hidden audio element for browser Web Audio playback */}
      <audio ref={audioElementRef} src={session.audioBlobUrl} preload="auto" />

      {/* Top Evidence Forensic HUD */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                AUDIO FORENSIC WORKBENCH
              </span>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                  session.overallSeverity === 'tampered'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : session.overallSeverity === 'suspicious'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                {session.overallSeverity}
              </span>
              {session.container.hasTrailingData && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-semibold animate-pulse">
                  Trailing Stego Payload Detected ({session.container.trailingBytesCount} B)
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
              <Mic className="w-5 h-5 text-cyan-400" />
              <span>{session.integrity.filename}</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Container:{' '}
              <strong className="text-slate-200">
                {session.container.format} ({session.container.audioEncodingFormat || 'Standard Audio'})
              </strong>{' '}
              • Duration:{' '}
              <strong className="text-cyan-300">{session.metrics.formattedDuration}</strong> • Sample
              Rate: <strong className="text-slate-200">{session.metrics.sampleRate.toLocaleString()} Hz</strong>{' '}
              • Channels:{' '}
              <strong className="text-slate-200">
                {session.metrics.channels === 1 ? '1 (Mono)' : `${session.metrics.channels} (Stereo)`}
              </strong>{' '}
              • Encoded Depth:{' '}
              <strong className="text-slate-200">
                {session.container.encodedBitDepth ? `${session.container.encodedBitDepth}-bit` : 'N/A (Compressed)'}
              </strong>{' '}
              • Decoded Depth: <strong className="text-slate-200">32-bit Float</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportWavDerivative}
              disabled={isExportingDerivative}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-mono font-medium transition cursor-pointer"
              title="Export selected time range or full audio as a new 16-bit PCM WAV derivative"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {selectionStart !== null && selectionEnd !== null
                  ? 'Export Selection (.WAV)'
                  : 'Export Derivative (.WAV)'}
              </span>
            </button>
          </div>
        </div>

        {/* Cryptographic Digests Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-[10px] text-slate-500 block uppercase">SHA-256 Digest (Original File)</span>
              <span className="text-slate-300 select-all font-mono text-[11px] truncate block">
                {session.integrity.sha256}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(session.integrity.sha256, 'sha256')}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer shrink-0"
              title="Copy SHA-256 to clipboard"
            >
              {copiedSha256 ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-[10px] text-slate-500 block uppercase">SHA-1 Digest (Legacy Validation)</span>
              <span className="text-slate-300 select-all font-mono text-[11px] truncate block">
                {session.integrity.sha1}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(session.integrity.sha1, 'sha1')}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer shrink-0"
              title="Copy SHA-1 to clipboard"
            >
              {copiedSha1 ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 font-mono text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('player')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'player'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <WaveformIcon className="w-4 h-4" />
          <span>Interactive Waveform</span>
        </button>

        <button
          onClick={() => setActiveTab('spectrogram')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'spectrogram'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <AudioWaveform className="w-4 h-4" />
          <span>FFT Spectrogram</span>
        </button>

        <button
          onClick={() => setActiveTab('anomalies')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'anomalies'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Editing Anomalies & Splices</span>
          {session.anomalies.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800">
              {session.anomalies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('container')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'container'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Container & Chunks</span>
        </button>

        <button
          onClick={() => setActiveTab('enf')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'enf'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>ENF & Mains Hum</span>
        </button>

        <button
          onClick={() => setActiveTab('derivatives')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition cursor-pointer ${
            activeTab === 'derivatives'
              ? 'bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Derivative Audit ({derivativesList.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: INTERACTIVE WAVEFORM & PLAYER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'player' && (
        <div className="space-y-6">
          {/* Waveform Canvas & Range Scrubbing */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                  Acoustic Sample Waveform
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  (Drag to select audition region • Red/Amber markers = detected anomalies)
                </span>
              </div>
              <div className="font-mono text-xs">
                <span className="text-cyan-400 font-bold">{formatAudioTimestamp(currentTime)}</span>
                <span className="text-slate-600"> / </span>
                <span className="text-slate-400">{session.metrics.formattedDuration}</span>
              </div>
            </div>

            {/* Canvas */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950">
              <canvas
                ref={waveformCanvasRef}
                width={1000}
                height={160}
                className="w-full h-40 cursor-crosshair block"
                onMouseDown={handleWaveformMouseDown}
                onMouseMove={handleWaveformMouseMove}
                onMouseUp={handleWaveformMouseUp}
              />
            </div>

            {/* Range Selection Information Bar */}
            {selectionStart !== null && selectionEnd !== null && (
              <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-between font-mono text-xs text-cyan-300">
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Selected Region:{' '}
                    <strong>
                      {formatAudioTimestamp(selectionStart)} - {formatAudioTimestamp(selectionEnd)}
                    </strong>{' '}
                    (Duration: {(selectionEnd - selectionStart).toFixed(3)}s)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectionStart(null);
                      setSelectionEnd(null);
                    }}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleExportWavDerivative}
                    className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] transition cursor-pointer"
                  >
                    Export Selection (.WAV)
                  </button>
                </div>
              </div>
            )}

            {/* Player Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold transition shadow-sm cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={handleStop}
                  className="w-9 h-9 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Stop and return to start"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                    isLooping
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Loop playback"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Playback speed selector */}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Speed:</span>
                  {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-2 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume & Mute */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-24 accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400 w-8">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Signal Dynamics & Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Peak Amplitude</span>
              <div className="text-lg font-bold font-mono text-slate-100">
                {session.metrics.peakDbFs} <span className="text-xs text-slate-400">dBFS</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {session.metrics.peakDbFs >= -0.1 ? 'Pegged at full scale (0 dBFS)' : 'Headroom available'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">RMS Loudness</span>
              <div className="text-lg font-bold font-mono text-slate-100">
                {session.metrics.rmsDbFs} <span className="text-xs text-slate-400">dBFS</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Dynamic Range: {session.metrics.dynamicRangeDb} dB
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Sample Clipping</span>
              <div
                className={`text-lg font-bold font-mono ${
                  session.metrics.clippingRatio > 0.1 ? 'text-red-400' : 'text-slate-100'
                }`}
              >
                {session.metrics.clippingCount.toLocaleString()}{' '}
                <span className="text-xs text-slate-400">({session.metrics.clippingRatio}%)</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {session.metrics.clippingCount === 0 ? 'Zero clipped samples' : 'Potential distortion/limiting'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Spectral Centroid</span>
              <div className="text-lg font-bold font-mono text-slate-100">
                {session.metrics.spectralCentroidHz.toLocaleString()} <span className="text-xs text-slate-400">Hz</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                ZCR: {session.metrics.zeroCrossingRate}
              </p>
            </div>
          </div>

          {/* Quick Notice: Synthetic Voice / AI Audio */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1 font-mono text-xs">
              <h4 className="font-bold text-slate-200 uppercase">
                Acoustic Biometric & Synthetic Voice Notice
              </h4>
              <p className="text-slate-400 leading-relaxed font-sans text-[11px]">
                Forensic Vision evaluates physical acoustic waveforms and container integrity. Automated deepfake voice detection is not implemented via local heuristics without reference neural models. We refrain from providing speculative or hallucinated AI probability percentages.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: FFT SPECTROGRAM */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'spectrogram' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">
                Fast Fourier Transform (FFT) Spectrogram
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Visualizes frequency distribution over time. Notice sudden horizontal line breaks or vertical energy bursts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs font-mono">
                <span className="text-slate-500 text-[10px] uppercase">FFT Size:</span>
                {[256, 512, 1024, 2048].map((size) => (
                  <button
                    key={size}
                    onClick={() => setFftSize(size as 256 | 512 | 1024 | 2048)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
                      fftSize === size
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setUseLogScale(!useLogScale)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                  useLogScale
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                {useLogScale ? 'Scale: Log' : 'Scale: Linear'}
              </button>
            </div>
          </div>

          {/* Spectrogram Canvas Frame with Frequency Y-Axis Labels */}
          <div className="relative flex rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            {/* Frequency axis labels */}
            <div className="w-16 bg-slate-950 border-r border-slate-800 py-2 px-1 flex flex-col justify-between text-right text-[10px] font-mono text-slate-500 select-none">
              <span>{Math.round(session.metrics.sampleRate / 2 / 1000)} kHz</span>
              <span>15 kHz</span>
              <span>10 kHz</span>
              <span>5 kHz</span>
              <span>1 kHz</span>
              <span>0 Hz</span>
            </div>

            {/* Spectrogram Canvas */}
            <div className="flex-1 relative overflow-hidden">
              <canvas
                ref={spectrogramCanvasRef}
                className="w-full h-72 block object-fill"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-16">
            <span>00:00.000</span>
            <span>{session.metrics.formattedDuration}</span>
          </div>

          {/* Color bar legend */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-[10px] text-slate-400 uppercase">Magnitude Legend:</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">-90 dBFS (Floor)</span>
              <div className="w-48 h-3 rounded bg-gradient-to-r from-blue-950 via-cyan-500 via-purple-600 to-amber-400" />
              <span className="text-[10px] text-amber-300">0 dBFS (Peak)</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: EDITING ANOMALIES & SPLICES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">
                  Audited Timeline Splice Points & Anomalies ({session.anomalies.length})
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Identified via 25ms sliding frame energy divergence, phase discontinuities, and sudden silence transitions.
                </p>
              </div>
            </div>

            {session.anomalies.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800/80">
                <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-200 font-mono">
                  No Suspicious Splices or Discontinuities Detected
                </h4>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Energy curve and ambient noise transitions appear continuous within expected thresholds.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {session.anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    className={`p-4 rounded-xl border transition ${
                      anom.category === 'Suspicious'
                        ? 'bg-red-950/20 border-red-800/60'
                        : anom.category === 'Potential Indicator'
                        ? 'bg-amber-950/20 border-amber-800/60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            anom.category === 'Suspicious'
                              ? 'bg-red-900/80 text-red-200'
                              : anom.category === 'Potential Indicator'
                              ? 'bg-amber-900/80 text-amber-200'
                              : 'bg-cyan-900/80 text-cyan-200'
                          }`}
                        >
                          {anom.category}
                        </span>
                        <h4 className="text-xs font-bold font-mono text-slate-200">
                          {anom.type}
                        </h4>
                        <span className="text-xs font-mono text-cyan-400">
                          @ {anom.formattedTimestamp}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          Confidence: {anom.confidence}%
                        </span>
                        <button
                          onClick={() => handleJumpToAnomaly(anom.timestamp)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-800 hover:border-cyan-800 text-[10px] font-mono transition cursor-pointer flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Jump to Timestamp</span>
                        </button>
                        <button
                          onClick={() => handleAuditionAB(anom.timestamp)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono transition cursor-pointer flex items-center gap-1"
                          title="Audition 500ms before and 500ms after"
                        >
                          <Scissors className="w-3 h-3" />
                          <span>A/B Audition (±500ms)</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-slate-300 font-mono text-[11px]">
                        <strong>Diagnostic Metric:</strong> {anom.metric}
                      </p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        <strong>Forensic Analysis:</strong> {anom.explanation}
                      </p>
                      <p className="text-slate-500 text-[11px] leading-relaxed italic">
                        <strong>Alternative Benign Hypothesis:</strong> {anom.alternativeHypothesis}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: CONTAINER & RIFF CHUNKS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'container' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">
                Binary Container & Header Inspection
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Declared chunk boundaries versus physical byte counts in storage.
              </p>
            </div>

            {/* Trailing Steganography Alert */}
            {session.container.hasTrailingData && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 space-y-2">
                <div className="flex items-center gap-2 text-red-300 font-bold text-xs font-mono">
                  <AlertOctagon className="w-4 h-4 text-red-400" />
                  <span>SUSPICIOUS TRAILING DATA DETECTED ({session.container.trailingBytesCount} BYTES)</span>
                </div>
                <p className="text-[11px] text-red-200 font-mono leading-relaxed">
                  The audio file contains {session.container.trailingBytesCount} bytes of extra payload data appended past the end of the declared audio container structure. This is a primary indicator of hidden steganographic messages, appended malware, or covert communication channels.
                </p>
                {session.container.trailingDataHexPreview && (
                  <pre className="p-3 rounded bg-slate-950 border border-red-900/60 font-mono text-[10px] text-red-300 overflow-x-auto">
                    {session.container.trailingDataHexPreview}
                  </pre>
                )}
              </div>
            )}

            {/* Chunk Hierarchy Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Chunk ID</th>
                    <th className="py-2.5 px-3">Byte Offset</th>
                    <th className="py-2.5 px-3">Length</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {session.container.chunks.map((chunk, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">{chunk.id}</td>
                      <td className="py-2.5 px-3 text-slate-400">0x{chunk.offset.toString(16).toUpperCase()} ({chunk.offset})</td>
                      <td className="py-2.5 px-3">{chunk.size.toLocaleString()} bytes</td>
                      <td className="py-2.5 px-3 text-slate-300">{chunk.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bit-Plane Steganography Assessment */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase">
                PCM Least Significant Bit (LSB) Entropy Audit
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Tested Channel</span>
                  <span className="text-slate-300">{session.lsbAnalysis.testedChannel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">LSB Bitplane Entropy</span>
                  <span className="text-cyan-300 font-bold">{session.lsbAnalysis.entropy} / 8.0</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Suspicion Index</span>
                  <span
                    className={
                      session.lsbAnalysis.suspicionScore > 70 ? 'text-red-400 font-bold' : 'text-slate-300'
                    }
                  >
                    {session.lsbAnalysis.suspicionScore} / 100
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans pt-1">
                {session.lsbAnalysis.assessment}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: ENF & MAINS HUM ANALYSIS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'enf' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">
                Electrical Network Frequency (ENF) Hum Analysis
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Audits magnetic and electrical mains induction tones (50 Hz / 60 Hz) to verify power-grid physical provenance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Candidate Grid Frequency</span>
                <div className="text-lg font-bold font-mono text-cyan-300">
                  {session.enf.detected ? `${session.enf.candidateFrequency} Hz` : 'None Isolated'}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Standard Nominal: {session.enf.nominalGrid}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Signal-to-Noise Ratio (SNR)</span>
                <div className="text-lg font-bold font-mono text-slate-100">
                  {session.enf.snrDb} <span className="text-xs text-slate-400">dB</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Prominence above acoustic noise floor
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">ENF Confidence</span>
                <div className="text-lg font-bold font-mono text-slate-100">
                  {session.enf.confidence}%
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Detection reliability score
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
              <h4 className="font-bold text-slate-200 uppercase">Acoustic Analysis Finding</h4>
              <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                {session.enf.explanation}
              </p>
            </div>

            {/* Mandatory honest disclaimer */}
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-900/60 flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <span className="font-bold text-slate-300">Chain of Custody Standard:</span>
                <p className="leading-relaxed font-sans">
                  {session.enf.disclaimer}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: DERIVATIVES AUDIT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'derivatives' && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">
                Exported Forensic Audio Derivatives ({derivativesList.length})
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                All exported clips are strictly tracked with their own SHA-256 digests and parent lineage records.
              </p>
            </div>
            <button
              onClick={handleExportWavDerivative}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Create New Derivative</span>
            </button>
          </div>

          {derivativesList.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 font-mono">
                No derivative audio cuts have been exported for this evidence item yet. Select a region on the waveform and click "Export Derivative (.WAV)".
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {derivativesList.map((deriv) => (
                <div
                  key={deriv.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[10px]">
                        {deriv.format}
                      </span>
                      <span className="font-bold text-slate-200">{deriv.filename}</span>
                    </div>
                    <a
                      href={deriv.blobUrl}
                      download={deriv.filename}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download File</span>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Time Span</span>
                      <span>{deriv.formattedTimeRange}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Duration</span>
                      <span>{deriv.duration}s</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">File Size</span>
                      <span>{deriv.fileSize.toLocaleString()} bytes</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Exported At</span>
                      <span>{new Date(deriv.derivedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[10px] text-slate-400 select-all truncate">
                    <strong className="text-slate-500">Derivative SHA-256: </strong>
                    <span className="text-cyan-300">{deriv.sha256}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
