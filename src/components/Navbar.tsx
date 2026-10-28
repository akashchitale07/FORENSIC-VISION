import React from 'react';
import { Shield, RotateCcw, Sparkles, Lock, HardDrive } from 'lucide-react';
import { CaseRecord, ImageForensicSession, VideoForensicSession, AudioForensicSession } from '../types/forensics';

interface NavbarProps {
  currentSession: ImageForensicSession | null;
  currentVideoSession?: VideoForensicSession | null;
  currentAudioSession?: AudioForensicSession | null;
  activeCase: CaseRecord;
  onResetSession: () => void;
  onLoadSample: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSession,
  currentVideoSession,
  currentAudioSession,
  activeCase,
  onResetSession,
  onLoadSample,
}) => {
  const hasActiveEvidence = Boolean(currentSession || currentVideoSession || currentAudioSession);

  return (
    <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
          <Shield className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-slate-100 text-base font-mono">
              FORENSIC <span className="text-cyan-400">VISION</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-mono font-medium">
              Image • Video • Audio Forensics
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal">
            Digital Media Investigation Workbench
          </p>
        </div>
      </div>

      {/* Case Info & Privacy Shield */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-500 font-medium">Active Case:</span>
          <span className="font-mono text-cyan-300 font-semibold">{activeCase.caseNumber}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 truncate max-w-[140px]">{activeCase.title}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-400 font-mono">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local Evidence Isolated</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onLoadSample}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-medium transition shadow-sm cursor-pointer"
          title="Explore forensic capabilities using pre-configured evidence samples"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Load Test Sample</span>
        </button>

        {hasActiveEvidence && (
          <button
            onClick={onResetSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/50 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800/60 text-xs font-medium transition cursor-pointer"
            title="Purge current evidence from memory and reset session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Evidence</span>
          </button>
        )}
      </div>
    </header>
  );
};
