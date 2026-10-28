import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Camera,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Layers,
  Split,
  Eye,
  AlertTriangle,
  Info,
  Clock,
  Film,
  Sparkles,
  Maximize2,
  Volume2,
  VolumeX,
  Gauge,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import {
  VideoForensicSession,
  ExtractedFrame,
  FrameTamperingEvent,
  MetadataEntry,
} from '../types/forensics';
import { formatVideoTimestamp } from '../utils/videoContainerParser';
import { compareFramePixels } from '../utils/frameAnalysis';

interface VideoForensicsViewProps {
  session: VideoForensicSession | null;
  onOpenUpload: () => void;
  onUpdateSessionFrames?: (frames: ExtractedFrame[], events: FrameTamperingEvent[]) => void;
}

type VideoSubTab = 'player' | 'contact-sheet' | 'tampering' | 'codec' | 'watermark' | 'metadata';

export const VideoForensicsView: React.FC<VideoForensicsViewProps> = ({
  session,
  onOpenUpload,
  onUpdateSessionFrames,
}) => {
  const [activeTab, setActiveTab] = useState<VideoSubTab>('player');

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(true);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  // Frame inspection
  const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(null);
  const [inspectedEvent, setInspectedEvent] = useState<FrameTamperingEvent | null>(null);

  // Metadata search & filter
  const [metadataQuery, setMetadataQuery] = useState('');
  const [metadataCategory, setMetadataCategory] = useState<string>('ALL');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Custom live extracted frames list
  const [customFrames, setCustomFrames] = useState<ExtractedFrame[]>([]);

  useEffect(() => {
    if (session) {
      setCustomFrames(session.extractedFrames);
      if (session.extractedFrames.length > 0) {
        setSelectedFrame(session.extractedFrames[0]);
      }
      if (session.tamperingEvents.length > 0) {
        setInspectedEvent(session.tamperingEvents[0]);
      }
    }
  }, [session]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const stepTime = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + deltaSeconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleExtractCurrentFrame = () => {
    if (!videoRef.current || !session) return;
    setIsExtractingFrame(true);

    const video = videoRef.current;
    const width = video.videoWidth || session.integrity.width;
    const height = video.videoHeight || session.integrity.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');

    const timestamp = video.currentTime;
    const frameIndex = customFrames.length;

    const newFrame: ExtractedFrame = {
      id: `FRAME-CUSTOM-${Date.now()}`,
      frameIndex,
      timestamp: Number(timestamp.toFixed(3)),
      formattedTimestamp: formatVideoTimestamp(timestamp),
      dataUrl,
      thumbnailUrl: dataUrl,
      width,
      height,
      extractionMethod: 'HTML5 Canvas Decoded Frame (User Requested)',
      perceptualHash: '',
      averageLuminance: 128,
    };

    const updated = [newFrame, ...customFrames];
    setCustomFrames(updated);
    setSelectedFrame(newFrame);
    setIsExtractingFrame(false);
  };

  const downloadFrame = (frame: ExtractedFrame) => {
    if (!session) return;
    const link = document.createElement('a');
    link.href = frame.dataUrl;
    link.download = `${session.integrity.filename}_frame_${frame.formattedTimestamp.replace(':', '_')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportMetadataJson = () => {
    if (!session) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session.metadataEntries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${session.integrity.filename}_video_metadata.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyMetadataValue = (tag: string, value: string) => {
    navigator.clipboard.writeText(`${tag}: ${value}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  if (!session) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto mb-4">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 font-mono mb-2">No Video Evidence Loaded</h3>
        <p className="text-xs text-slate-400 mb-6">
          Ingest an MP4, MOV, or WebM video file, or select a pre-configured video evidence sample to launch the Phase 2 Video Forensics Workspace.
        </p>
        <button
          onClick={onOpenUpload}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide transition cursor-pointer"
        >
          Load Video Evidence
        </button>
      </div>
    );
  }

  const { integrity, metadataEntries, tamperingEvents, watermark } = session;

  const filteredMetadata = metadataEntries.filter((m) => {
    const matchesSearch =
      m.tag.toLowerCase().includes(metadataQuery.toLowerCase()) ||
      m.label.toLowerCase().includes(metadataQuery.toLowerCase()) ||
      m.value.toLowerCase().includes(metadataQuery.toLowerCase());
    const matchesCat = metadataCategory === 'ALL' || m.category === metadataCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Evidence Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              PHASE 2: VIDEO FORENSICS WORKBENCH
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              {integrity.detectedFormat}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 font-mono mt-0.5">
            {integrity.filename}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Duration: {integrity.formattedDuration} ({integrity.duration.toFixed(2)}s) • {integrity.width}×{integrity.height} • Bitrate: ~{integrity.bitrateKbps} kbps • SHA-256: {integrity.sha256.substring(0, 16)}...
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          {[
            { id: 'player', label: 'Player & Frame Extractor', icon: <Film className="w-3.5 h-3.5" /> },
            { id: 'contact-sheet', label: 'Contact Sheet & Timeline', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'tampering', label: 'Frame Differences & Cuts', icon: <Split className="w-3.5 h-3.5" /> },
            { id: 'codec', label: 'Codec & Atoms', icon: <Cpu className="w-3.5 h-3.5" /> },
            { id: 'watermark', label: 'Watermarks', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'metadata', label: 'Technical Metadata', icon: <Search className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as VideoSubTab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: VIDEO PLAYER & FRAME EXTRACTOR */}
      {activeTab === 'player' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Player & Custom Controls (8 cols) */}
          <div className="lg:col-span-8 rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center min-h-[360px] max-h-[500px]">
              <video
                ref={videoRef}
                src={session.videoBlobUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="max-h-[480px] w-auto object-contain mx-auto"
                playsInline
                muted={isMuted}
              />
            </div>

            {/* Custom Forensic Controls HUD */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
              {/* Seeker slider */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-cyan-400 font-bold min-w-[65px]">
                  {formatVideoTimestamp(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={integrity.duration || 1}
                  step="0.01"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-cyan-500 cursor-pointer"
                />
                <span className="text-slate-500 min-w-[65px] text-right">
                  {formatVideoTimestamp(integrity.duration)}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-850">
                {/* Playback Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stepTime(-0.1)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Step backward 0.1s"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold transition shadow-sm cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={() => stepTime(0.1)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Step forward 0.1s"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  {/* Volume Toggle */}
                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (videoRef.current) videoRef.current.muted = !isMuted;
                    }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer ml-1"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                  </button>
                </div>

                {/* Speed Selector */}
                <div className="flex items-center gap-1 p-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                  {[0.25, 0.5, 1.0, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedChange(s)}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${
                        playbackSpeed === s ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Extract Frame Button */}
                <button
                  onClick={handleExtractCurrentFrame}
                  disabled={isExtractingFrame}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Extract Current Frame</span>
                </button>
              </div>
            </div>

            {/* Ingestion Notes */}
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>Decoder: Native HTML5 Hardware Accelerated</span>
              <span>Method: Decoded Frame Pixel Extraction</span>
            </div>
          </div>

          {/* Right Column: Selected / Extracted Frame Inspector (4 cols) */}
          <div className="lg:col-span-4 rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Extracted Frame Derivative
                </h3>
                {selectedFrame && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {selectedFrame.formattedTimestamp}
                  </span>
                )}
              </div>

              {selectedFrame ? (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center aspect-video">
                    <img src={selectedFrame.dataUrl} alt="Extracted Frame" className="w-full h-full object-contain" />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Timestamp:</span>
                      <span className="text-cyan-400 font-bold">{selectedFrame.formattedTimestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dimensions:</span>
                      <span className="text-slate-300">{selectedFrame.width} × {selectedFrame.height} px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Luminance:</span>
                      <span className="text-slate-300">{selectedFrame.averageLuminance} / 255</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Method:</span>
                      <span className="text-slate-400 truncate max-w-[150px]">{selectedFrame.extractionMethod}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadFrame(selectedFrame)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Frame Derivative</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No frame currently selected. Click "Extract Current Frame" or choose a frame from the contact sheet.
                </div>
              )}
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-500 font-mono leading-relaxed">
              Legal Disclosure: Extracted frames are stored and exported as labelled derivative forensic assets. The original video file container remains unmodified.
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CONTACT SHEET & TIMELINE */}
      {activeTab === 'contact-sheet' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Sampled Frame Contact Sheet ({customFrames.length} Frames Extracted)
              </h3>
              <span className="text-[11px] text-cyan-400">
                Sampling Interval: ~{session.samplingIntervalSeconds.toFixed(2)}s
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Click on any frame thumbnail to view high-resolution details or jump the video player directly to that timecode.
            </p>
          </div>

          {/* Contact Sheet Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {customFrames.map((frame, idx) => {
              const isSelected = selectedFrame?.id === frame.id;
              return (
                <div
                  key={frame.id}
                  onClick={() => {
                    setSelectedFrame(frame);
                    if (videoRef.current) videoRef.current.currentTime = frame.timestamp;
                  }}
                  className={`p-2 rounded-xl border bg-slate-900/60 hover:bg-slate-900 transition cursor-pointer flex flex-col justify-between group ${
                    isSelected ? 'border-cyan-500 ring-1 ring-cyan-500/40 bg-slate-900' : 'border-slate-800'
                  }`}
                >
                  <div className="relative rounded overflow-hidden bg-black aspect-video mb-1.5">
                    <img src={frame.thumbnailUrl} alt={`Frame at ${frame.formattedTimestamp}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono text-cyan-300 font-bold">
                      {frame.formattedTimestamp}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Frame #{idx + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFrame(frame);
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                      title="Download frame"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: FRAME DIFFERENCES & SCENE CUTS */}
      {activeTab === 'tampering' && (
        <div className="space-y-6">
          {/* Header Explanation */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Frame-to-Frame Temporal Discontinuity & Tampering Analysis
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Evaluates visual difference and perceptual dHash distances across adjacent frames. High perceptual shifts indicate scene transitions, camera pans, or injected splice boundaries.
            </p>
          </div>

          {/* Events List & Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Events List (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Candidate Transition Events ({tamperingEvents.length})
              </div>

              {tamperingEvents.length > 0 ? (
                <div className="space-y-2.5">
                  {tamperingEvents.map((evt) => {
                    const isSelected = inspectedEvent?.id === evt.id;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => setInspectedEvent(evt)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer font-mono ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-700 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-cyan-300">
                            {evt.formattedTimestamp}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              evt.severity === 'suspicious'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : evt.severity === 'tampered'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {evt.severity}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-200 mb-1">
                          {evt.method} ({evt.metric})
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {evt.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-400 text-center">
                  No sudden visual jumps, scene cuts, or duplicate frame freezes detected across sampled intervals.
                </div>
              )}
            </div>

            {/* Event Comparison Viewer (7 cols) */}
            <div className="lg:col-span-7 rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 font-mono">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Frame Transition Comparison Viewer
              </h4>

              {inspectedEvent ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Previous Frame */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">
                        Pre-Transition Frame
                      </span>
                      <div className="rounded overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                        {inspectedEvent.previousFrameDataUrl ? (
                          <img src={inspectedEvent.previousFrameDataUrl} alt="Previous Frame" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-slate-600 text-xs">No reference frame</span>
                        )}
                      </div>
                    </div>

                    {/* Current Frame */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-cyan-400 font-bold">
                        Target Frame ({inspectedEvent.formattedTimestamp})
                      </span>
                      <div className="rounded overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                        {inspectedEvent.frameDataUrl ? (
                          <img src={inspectedEvent.frameDataUrl} alt="Current Frame" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-slate-600 text-xs">No target frame</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Findings Details Box */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between text-cyan-300 font-bold">
                      <span>Diagnostic Event: {inspectedEvent.id}</span>
                      <span>Metric: {inspectedEvent.metric}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {inspectedEvent.explanation}
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-500 leading-relaxed">
                    Forensic Caveat: Abrupt visual change indicates a discontinuity in spatial content (e.g. shot cut, camera obstruction, edit boundary). It does not by itself prove malicious tampering without narrative and chain-of-custody corroboration.
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs font-mono">
                  Select an event from the candidate list to inspect pre- and post-transition frames side by side.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CODEC & CONTAINER ATOMS */}
      {activeTab === 'codec' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 font-mono">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Container Specification & Encoding Properties
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Video Codec FourCC</span>
                <div className="text-cyan-400 font-bold mt-1">{integrity.videoCodec}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Declared stream encoding</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Audio Stream Codec</span>
                <div className="text-slate-200 font-bold mt-1">{integrity.audioCodec}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">{integrity.hasAudio ? 'Audio Stream Present' : 'No Audio Track'}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Container Fast-Start</span>
                <div className="text-slate-200 font-bold mt-1">{integrity.moovPosition || 'Not Applicable'}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Movie atom placement</div>
              </div>
            </div>
          </div>

          {/* Parsed Atom / Track Boxes */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                Parsed Container Atom / Element Hierarchy ({integrity.atomsOrTracks.length} Entries)
              </h4>
              <span className="text-[11px] text-slate-500">ISOBMFF / EBML Stream</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {integrity.atomsOrTracks.map((atom, idx) => (
                <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-850 flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold text-cyan-400">{atom.name}</span>
                  <span className="text-slate-500">Offset: 0x{atom.offset.toString(16).toUpperCase()} • Size: {atom.size} bytes</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unsupported Features / Native FFmpeg Limitations */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase text-[11px]">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Browser Sandbox Technical Limitations & Unsupported Codec Features</span>
            </div>
            {integrity.unavailableFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-400 text-[11px]">
                <span className="text-slate-600">•</span>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: WATERMARKS */}
      {activeTab === 'watermark' && (
        <div className="space-y-6">
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              watermark.status === 'Detected'
                ? 'bg-cyan-950/40 border-cyan-800 text-cyan-200'
                : watermark.status === 'Potential Indicator'
                ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                VIDEO WATERMARK & OVERLAY RESULT
              </span>
              <h3 className="text-base font-bold font-mono mt-0.5">
                Status: {watermark.status} (Confidence: {watermark.confidence}%)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Persistent corner high-frequency clusters evaluated across sampled video frames.
              </p>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 uppercase">
              {watermark.status}
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
            <h4 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
              Diagnostic Findings
            </h4>
            <div className="space-y-2">
              {watermark.findings.map((f, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: TECHNICAL METADATA */}
      {activeTab === 'metadata' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search video tags or values (e.g. Codec, Brand, Timescale)..."
                value={metadataQuery}
                onChange={(e) => setMetadataQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {['ALL', 'CONTAINER', 'CODEC', 'TRACK', 'EXIF'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMetadataCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    metadataCategory === cat
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <button
                onClick={exportMetadataJson}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition cursor-pointer ml-auto"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden font-mono">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Tag Identifier</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Standard Label</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMetadata.length > 0 ? (
                  filteredMetadata.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/50 transition">
                      <td className="py-2.5 px-4 font-semibold text-cyan-400">{entry.tag}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-400">
                          {entry.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{entry.label}</td>
                      <td className="py-2.5 px-4 text-slate-200 break-all">{entry.value}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => copyMetadataValue(entry.tag, entry.value)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                          title="Copy tag and value"
                        >
                          {copiedTag === entry.tag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No video metadata tags matching current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
