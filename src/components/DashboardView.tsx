import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Maximize2,
  FileText,
  FileCode,
  Sliders,
  Layers,
  Sparkles,
  ExternalLink,
  MapPin,
  Camera,
  Activity,
  ArrowRight,
  Video,
  Film,
  Scissors,
  Box,
  Play,
  Clock,
  Gauge,
  Mic,
  AudioWaveform,
} from 'lucide-react';
import {
  ImageForensicSession,
  VideoForensicSession,
  AudioForensicSession,
  CaseRecord,
} from '../types/forensics';
import { UploadArea } from './UploadArea';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  session: ImageForensicSession | null;
  videoSession?: VideoForensicSession | null;
  audioSession?: AudioForensicSession | null;
  activeCase: CaseRecord;
  onFileSelected: (file: File) => void;
  isAnalyzing: boolean;
  analysisStage?: string;
  analysisProgress?: number;
  errorMessage?: string | null;
  onClearError: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenInspectModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  session,
  videoSession,
  audioSession,
  activeCase,
  onFileSelected,
  isAnalyzing,
  analysisStage,
  analysisProgress,
  errorMessage,
  onClearError,
  onNavigateTab,
}) => {
  const [copiedSha256, setCopiedSha256] = useState(false);
  const [copiedSha1, setCopiedSha1] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video' | 'audio'>(
    audioSession ? 'audio' : videoSession ? 'video' : 'image'
  );

  // Sync tab if sessions change
  React.useEffect(() => {
    if (audioSession && !session && !videoSession) {
      setActiveMediaTab('audio');
    } else if (videoSession && !session && !audioSession) {
      setActiveMediaTab('video');
    } else if (session && !videoSession && !audioSession) {
      setActiveMediaTab('image');
    }
  }, [session, videoSession, audioSession]);

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

  const hasAnyEvidence = Boolean(session || videoSession || audioSession);

  if (!hasAnyEvidence) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  Investigation Workbench Active • Phase 1 & 2 Live
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-100 font-mono tracking-tight">
                Digital Media Forensics Platform
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Ingest digital imagery and video assets to verify cryptographic non-repudiation (SHA-256/SHA-1), inspect container atom hierarchies, extract frame sequences, run JPEG Error Level Analysis (ELA), detect video scene cuts, and audit steganographic payloads.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-right font-mono">
                <div className="text-[10px] text-slate-500 uppercase">Target Case</div>
                <div className="text-xs text-cyan-300 font-bold">{activeCase.caseNumber}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Component */}
        <UploadArea
          onFileSelected={onFileSelected}
          isAnalyzing={isAnalyzing}
          analysisStage={analysisStage}
          analysisProgress={analysisProgress}
          errorMessage={errorMessage}
          onClearError={onClearError}
        />
      </div>
    );
  }

  // Switcher if multiple sessions are loaded
  const loadedCount = (session ? 1 : 0) + (videoSession ? 1 : 0) + (audioSession ? 1 : 0);
  const showMultiSwitcher = loadedCount > 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Evidence Type Switcher if multiple loaded */}
      {showMultiSwitcher && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 px-3">Active Evidence:</span>
            {audioSession && (
              <button
                onClick={() => setActiveMediaTab('audio')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                  activeMediaTab === 'audio'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Audio: {audioSession.integrity.filename}</span>
              </button>
            )}
            {session && (
              <button
                onClick={() => setActiveMediaTab('image')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                  activeMediaTab === 'image'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Image: {session.integrity.filename}</span>
              </button>
            )}
            {videoSession && (
              <button
                onClick={() => setActiveMediaTab('video')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                  activeMediaTab === 'video'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video: {videoSession.integrity.filename}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* RENDER AUDIO DASHBOARD IF AUDIO TAB IS ACTIVE */}
      {activeMediaTab === 'audio' && audioSession ? (
        <div className="space-y-6">
          {/* Audio Session Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/80 text-[10px] font-bold text-cyan-300">
                  AUDIO EVIDENCE
                </span>
                <span>•</span>
                <span>SESSION: {audioSession.id}</span>
                <span>•</span>
                <span>CASE: {activeCase.caseNumber}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 font-mono flex items-center gap-2">
                <span>{audioSession.integrity.filename}</span>
                <span className="text-xs font-normal text-slate-400">
                  ({audioSession.metrics.formattedDuration} • {audioSession.container.format})
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigateTab('audio-forensics')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition shadow-sm cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Open Audio Workbench</span>
              </button>
              <button
                onClick={() => onNavigateTab('reports')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-medium transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Audio Report</span>
              </button>
            </div>
          </div>

          {/* Audio Severity Verdict Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              audioSession.overallSeverity === 'tampered'
                ? 'bg-red-950/40 border-red-800/80 text-red-200'
                : audioSession.overallSeverity === 'suspicious'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                : audioSession.overallSeverity === 'low'
                ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
                : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  audioSession.overallSeverity === 'tampered'
                    ? 'bg-red-900/60 text-red-400'
                    : audioSession.overallSeverity === 'suspicious'
                    ? 'bg-amber-900/60 text-amber-400'
                    : 'bg-emerald-900/60 text-emerald-400'
                }`}
              >
                {audioSession.overallSeverity === 'tampered' ? (
                  <AlertOctagon className="w-5 h-5 text-red-400" />
                ) : audioSession.overallSeverity === 'suspicious' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-wider uppercase">
                    Forensic Verdict:
                  </span>
                  <span className="text-xs font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-black/40 border border-current">
                    {audioSession.overallSeverity}
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5 font-sans">
                  {audioSession.container.hasTrailingData
                    ? `Covert appended trailing payload (${audioSession.container.trailingBytesCount} bytes) detected beyond declared audio container boundaries.`
                    : audioSession.anomalies.length > 0
                    ? `${audioSession.anomalies.length} acoustic/splice anomalies identified across timeline.`
                    : 'Signal exhibits continuous acoustic harmonics and consistent room reverberation.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('audio-forensics')}
              className="px-3.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-current text-xs font-mono font-semibold transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              Examine in Audio Workbench →
            </button>
          </div>

          {/* Quick Metrics 4-Pack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigateTab('audio-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <AudioWaveform className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {audioSession.metrics.peakDbFs} dBFS
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Signal Dynamics & RMS
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  RMS: {audioSession.metrics.rmsDbFs} dBFS • Dynamic Range: {audioSession.metrics.dynamicRangeDb} dB • Clipping: {audioSession.metrics.clippingCount} samples.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>View Waveform</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => onNavigateTab('audio-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      audioSession.anomalies.length > 0
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {audioSession.anomalies.length} Markers
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Splice & Anomaly Audit
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {audioSession.anomalies.length > 0
                    ? `${audioSession.anomalies.length} potential splice cuts, silence drops, or saturation events.`
                    : 'Zero abrupt energy steps or room dropouts detected.'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Splices</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => onNavigateTab('audio-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Box className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      audioSession.container.hasTrailingData
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {audioSession.container.chunks.length} Chunks
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Container & Chunks
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {audioSession.container.hasTrailingData
                    ? `Alert: ${audioSession.container.trailingBytesCount} trailing bytes appended past data chunk!`
                    : `Valid ${audioSession.container.format} structure. All chunk lengths match file size.`}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>View Chunks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => onNavigateTab('audio-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {audioSession.enf.detected ? `${audioSession.enf.candidateFrequency} Hz` : 'No Hum'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  ENF Power Mains Hum
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {audioSession.enf.detected
                    ? `Isolated candidate ${audioSession.enf.candidateFrequency} Hz inductive mains hum (SNR: ${audioSession.enf.snrDb} dB).`
                    : 'No prominent 50Hz or 60Hz mains induction tone detected.'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect ENF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      ) : activeMediaTab === 'video' && videoSession ? (
        <div className="space-y-6">
          {/* Video Session Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/80 text-[10px] font-bold text-cyan-300">
                  VIDEO EVIDENCE
                </span>
                <span>•</span>
                <span>SESSION: {videoSession.id}</span>
                <span>•</span>
                <span>CASE: {activeCase.caseNumber}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 font-mono flex items-center gap-2">
                <span>{videoSession.integrity.filename}</span>
                <span className="text-xs font-normal text-slate-400">
                  ({videoSession.integrity.formattedSize} • {videoSession.integrity.detectedFormat})
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigateTab('reports')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-medium transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Video Forensic Report</span>
              </button>
            </div>
          </div>

          {/* Video Severity Verdict Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              videoSession.overallSeverity === 'tampered'
                ? 'bg-red-950/40 border-red-800/80 text-red-200'
                : videoSession.overallSeverity === 'suspicious'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                : videoSession.overallSeverity === 'low'
                ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
                : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  videoSession.overallSeverity === 'tampered'
                    ? 'bg-red-900/60 text-red-400'
                    : videoSession.overallSeverity === 'suspicious'
                    ? 'bg-amber-900/60 text-amber-400'
                    : 'bg-emerald-900/60 text-emerald-400'
                }`}
              >
                {videoSession.overallSeverity === 'tampered' ? (
                  <AlertOctagon className="w-6 h-6" />
                ) : videoSession.overallSeverity === 'suspicious' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">
                    VIDEO FORENSIC VERDICT:
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/40 uppercase">
                    {videoSession.overallSeverity}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {videoSession.overallSeverity === 'tampered'
                    ? 'Abrupt visual discontinuities and significant perceptual divergence observed across sampled frames.'
                    : videoSession.overallSeverity === 'suspicious'
                    ? 'Potential visual anomalies, scene cut transitions, or watermark candidate overlays flagged for analyst inspection.'
                    : videoSession.overallSeverity === 'low'
                    ? 'Container metadata is minimal or atypical, but no active tampering detected in sampled video timeline.'
                    : 'Video timeline continuous and consistent. No anomalous frame transitions or tampering indicators observed.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('video-forensics')}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition cursor-pointer shadow"
            >
              <Video className="w-4 h-4" />
              <span>Open Video Forensics Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Grid: Video Player Preview & Cryptographic Hashes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Video Player Card (6 cols) */}
            <div className="lg:col-span-6 rounded-xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Film className="w-4 h-4 text-cyan-400" />
                    <span>Evidence Video Playback</span>
                  </h3>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {videoSession.integrity.width} × {videoSession.integrity.height} ({videoSession.integrity.aspectRatio})
                  </span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center min-h-[260px] max-h-[360px]">
                  <video
                    src={videoSession.videoBlobUrl}
                    controls
                    className="max-h-[340px] w-full object-contain"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Duration: {videoSession.integrity.formattedDuration}</span>
                <span>Frame Rate: ~{videoSession.integrity.frameRate} fps</span>
                <span>Frames Sampled: {videoSession.extractedFrames.length}</span>
              </div>
            </div>

            {/* Right Column: Cryptographic Integrity Details (6 cols) */}
            <div className="lg:col-span-6 rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Video Cryptographic Evidence Integrity
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Immutable Chain Verified</span>
                </span>
              </div>

              {/* SHA-256 Hash Box */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-cyan-400 font-semibold">SHA-256 Digest (FIPS 180-4)</span>
                  <button
                    onClick={() => copyToClipboard(videoSession.integrity.sha256, 'sha256')}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    {copiedSha256 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSha256 ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all select-all bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {videoSession.integrity.sha256}
                </div>
              </div>

              {/* SHA-1 Hash Box */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-cyan-400 font-semibold">SHA-1 Digest</span>
                  <button
                    onClick={() => copyToClipboard(videoSession.integrity.sha1, 'sha1')}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    {copiedSha1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSha1 ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all select-all bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {videoSession.integrity.sha1}
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Byte Size</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">{videoSession.integrity.formattedSize}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Bitrate</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5 truncate">
                    {videoSession.integrity.bitrateKbps ? `${videoSession.integrity.bitrateKbps} kbps` : 'Variable'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Video Codec</div>
                  <div className="text-xs text-cyan-300 font-bold mt-0.5">{videoSession.integrity.videoCodec || 'Browser dec'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Fast-Start</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">
                    {videoSession.integrity.moovPosition || 'Standard'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Video Forensic Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Container & Atoms */}
            <div
              onClick={() => onNavigateTab('video-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
                    <Box className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {videoSession.integrity.atomsOrTracks.length} Boxes/Atoms
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Container Atoms & Structure
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  Format: {videoSession.integrity.detectedFormat} • Audio: {videoSession.integrity.audioCodec} • Codec: {videoSession.integrity.videoCodec}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Box Hierarchy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 2: Contact Sheet & Timeline */}
            <div
              onClick={() => onNavigateTab('video-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
                    <Film className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {videoSession.extractedFrames.length} Frames
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Frame Extraction & Contact Sheet
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  Sample interval: {videoSession.samplingIntervalSeconds.toFixed(2)}s • High-res derivatives & PNG export available.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 3: Frame Tampering & Cut Detection */}
            <div
              onClick={() => onNavigateTab('video-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      videoSession.tamperingEvents.some((e) => e.severity === 'suspicious' || e.severity === 'tampered')
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : videoSession.tamperingEvents.length > 0
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {videoSession.tamperingEvents.length} Events
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Frame Differences & Scene Cuts
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {videoSession.tamperingEvents.length > 0
                    ? `${videoSession.tamperingEvents.length} transition anomalies detected (dHash / pixel MAE).`
                    : 'Continuous visual sequence. No abrupt scene cuts or frame freezes detected.'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Frame Diff</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 4: Watermark & Overlay Heuristics */}
            <div
              onClick={() => onNavigateTab('video-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      videoSession.watermark.status === 'Detected'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : videoSession.watermark.status === 'Potential Indicator'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {videoSession.watermark.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Watermarks & Video Codecs
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {videoSession.watermark.detectedTextSignatures.length > 0
                    ? `Signatures: ${videoSession.watermark.detectedTextSignatures.join(', ')}`
                    : `Codec: ${videoSession.integrity.videoCodec || 'Standard'} • No static persistent logo flag.`}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Watermarks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      ) : session ? (
        /* RENDER IMAGE DASHBOARD IF IMAGE TAB IS ACTIVE OR DEFAULT */
        <div className="space-y-6">
          {/* Session Header / Case Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800/80 text-[10px] font-bold text-blue-300">
                  IMAGE EVIDENCE
                </span>
                <span>•</span>
                <span>SESSION: {session.id}</span>
                <span>•</span>
                <span>CASE: {activeCase.caseNumber}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 font-mono flex items-center gap-2">
                <span>{session.integrity.filename}</span>
                <span className="text-xs font-normal text-slate-400">({session.integrity.formattedSize})</span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigateTab('reports')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-medium transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Forensic Report</span>
              </button>
            </div>
          </div>

          {/* Primary Severity Verdict Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              session.overallSeverity === 'tampered'
                ? 'bg-red-950/40 border-red-800/80 text-red-200'
                : session.overallSeverity === 'suspicious'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                : session.overallSeverity === 'low'
                ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
                : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  session.overallSeverity === 'tampered'
                    ? 'bg-red-900/60 text-red-400'
                    : session.overallSeverity === 'suspicious'
                    ? 'bg-amber-900/60 text-amber-400'
                    : 'bg-emerald-900/60 text-emerald-400'
                }`}
              >
                {session.overallSeverity === 'tampered' ? (
                  <AlertOctagon className="w-6 h-6" />
                ) : session.overallSeverity === 'suspicious' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">
                    FORENSIC SEVERITY VERDICT:
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/40 uppercase">
                    {session.overallSeverity}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {session.overallSeverity === 'tampered'
                    ? 'Structural tampering or severe compression disparity observed (e.g. appended stego payload or high ELA discrepancy).'
                    : session.overallSeverity === 'suspicious'
                    ? 'Suspicious indicators detected; localized compression divergence or watermark candidate requires manual review.'
                    : session.overallSeverity === 'low'
                    ? 'Minor non-critical variance or missing camera metadata noted. No active tampering identified.'
                    : 'Evidence file passed all supported integrity, ELA consistency, and steganography baseline tests.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('image-forensics')}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-slate-200 text-xs font-mono transition cursor-pointer"
            >
              <span>Open Full Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Grid: Evidence Preview & Cryptographic Hashes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Image Preview Card (5 cols) */}
            <div className="lg:col-span-5 rounded-xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    Evidence Raster Preview
                  </h3>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {session.integrity.width} × {session.integrity.height} ({session.integrity.aspectRatio})
                  </span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[360px]">
                  <img
                    src={session.previewUrl}
                    alt="Evidence Subject"
                    className="max-h-[340px] w-auto object-contain mx-auto"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Format: {session.integrity.detectedFormat}</span>
                <span>Entropy: {session.integrity.shannonEntropy} / 8.00</span>
              </div>
            </div>

            {/* Right Column: Cryptographic Integrity Details (7 cols) */}
            <div className="lg:col-span-7 rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Evidence Cryptographic Integrity
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Immutable Chain Verified</span>
                </span>
              </div>

              {/* SHA-256 Hash Box */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-cyan-400 font-semibold">SHA-256 Digest (FIPS 180-4)</span>
                  <button
                    onClick={() => copyToClipboard(session.integrity.sha256, 'sha256')}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    {copiedSha256 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSha256 ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all select-all bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {session.integrity.sha256}
                </div>
              </div>

              {/* SHA-1 Hash Box */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-cyan-400 font-semibold">SHA-1 Digest</span>
                  <button
                    onClick={() => copyToClipboard(session.integrity.sha1, 'sha1')}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    {copiedSha1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSha1 ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all select-all bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {session.integrity.sha1}
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Byte Size</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">{session.integrity.formattedSize}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">MIME Type</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5 truncate">{session.integrity.mimeType}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Entropy</div>
                  <div className="text-xs text-cyan-300 font-bold mt-0.5">{session.integrity.shannonEntropy} / 8</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase">Aspect Ratio</div>
                  <div className="text-xs text-slate-200 font-bold mt-0.5">{session.integrity.aspectRatio}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Forensic Pillars Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Metadata */}
            <div
              onClick={() => onNavigateTab('image-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {session.metadata.length} Tags
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Metadata & EXIF Telemetry
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {session.gps.hasGps ? `GPS: ${session.gps.formattedCoords}` : 'No GPS coordinates found.'}
                  {(() => {
                    const model = session.metadata.find(
                      (m) =>
                        m.category === 'EXIF' &&
                        (m.tag.toLowerCase() === 'model' || m.tag.toLowerCase() === 'cameramodel') &&
                        m.value.trim().length > 1
                    );
                    return model ? ` • Model: ${model.value}` : '';
                  })()}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect EXIF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 2: ELA / Tampering */}
            <div
              onClick={() => onNavigateTab('image-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      session.ela && session.ela.severity === 'tampered'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : session.ela && session.ela.severity === 'suspicious'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {session.ela ? session.ela.severity : 'N/A (Non-JPEG)'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Error Level Analysis (ELA)
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {session.ela
                    ? `Avg disparity: ${session.ela.averageDisparity} • High disparity: ${session.ela.highDisparityRatio}%`
                    : 'JPEG recompression disparity analysis only available for JPEG files.'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect ELA</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 3: Steganography */}
            <div
              onClick={() => onNavigateTab('image-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      session.stego && session.stego.hasTrailingData
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : session.stego && session.stego.severity === 'suspicious'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {session.stego && session.stego.hasTrailingData ? 'Trailing Payload' : session.stego?.severity}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Steganography & LSB
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {session.stego?.hasTrailingData
                    ? `ANOMALY: ${session.stego.trailingBytesCount} trailing bytes after EOI marker!`
                    : `LSB entropy: ${session.stego?.lsbEntropy} • No trailing data detected.`}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Bit Planes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 4: Watermarks */}
            <div
              onClick={() => onNavigateTab('image-forensics')}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/80 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      session.watermark && session.watermark.status === 'Detected'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : session.watermark && session.watermark.status === 'Potential Indicator'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {session.watermark ? session.watermark.status : 'Checking'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                  Watermarks & Overlays
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {session.watermark?.status === 'Detected'
                    ? `Watermark flag: ${session.watermark.detectedTextSignatures[0] || session.watermark.aiModelSignatures[0] || 'Detected'}`
                    : `${session.watermark?.candidateAreasCount || 0} corner candidate clusters evaluated.`}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Inspect Watermarks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
