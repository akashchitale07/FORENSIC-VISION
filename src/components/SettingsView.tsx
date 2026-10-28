import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Trash2,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Info,
  Cpu,
} from 'lucide-react';
import { ElaSettings } from '../types/forensics';

interface SettingsViewProps {
  elaSettings: ElaSettings;
  onUpdateElaSettings: (settings: ElaSettings) => void;
  onPurgeAllEvidence: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  elaSettings,
  onUpdateElaSettings,
  onPurgeAllEvidence,
}) => {
  const [quality, setQuality] = useState(elaSettings.jpegQuality);
  const [multiplier, setMultiplier] = useState(elaSettings.scaleMultiplier);
  const [isSaved, setIsSaved] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const handleSaveDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateElaSettings({
      jpegQuality: quality,
      scaleMultiplier: multiplier,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePurge = () => {
    onPurgeAllEvidence();
    setConfirmPurge(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
          SYSTEM PREFERENCES
        </span>
        <h2 className="text-xl font-bold text-slate-100 font-mono mt-0.5">
          Platform Settings & Privacy Safeguards
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Configure analysis thresholds, verify zero-leak client privacy, and manage evidence retention.
        </p>
      </div>

      {/* Privacy & Air-Gap Compliance Card */}
      <div className="p-6 rounded-xl bg-slate-950 border border-emerald-800/60 space-y-4 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700/80 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-400 uppercase">
              Zero-Leak Evidence Isolation Protocol
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Strict client-side execution for sensitive digital evidence.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
          <p>
            • <strong>Local Buffer Memory:</strong> All cryptographic hashing (SHA-256, SHA-1), image raster decoding, pixel-level Error Level Analysis, LSB bit-plane extraction, and EXIF/IPTC parsing are computed exclusively within your browser's WebCrypto and HTML5 Canvas sandbox.
          </p>
          <p>
            • <strong>No External AI Data Transmission:</strong> Evidence files are never dispatched to external cloud vision or third-party AI APIs without explicit user configuration.
          </p>
          <p>
            • <strong>Read-Only Safety:</strong> Ingested files are cloned in memory as read-only ArrayBuffers to prevent evidence spoliation.
          </p>
        </div>
      </div>

      {/* Default Analysis Parameters */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5 font-mono">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Default Forensic Analysis Parameters</span>
        </h3>

        <form onSubmit={handleSaveDefaults} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Default ELA Recompression Quality ({quality}%)
              </label>
              <input
                type="range"
                min="60"
                max="95"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard baseline: 85% for balanced error dissipation.
              </span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Default ELA Gain Multiplier ({multiplier}x)
              </label>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Amplifies pixel difference for human visual inspection.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {isSaved ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle className="w-4 h-4" />
                <span>Settings Updated</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-bold transition cursor-pointer"
            >
              Save Defaults
            </button>
          </div>
        </form>
      </div>

      {/* Evidence Memory Purge */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-red-900/40 space-y-4 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase">
              Purge In-Memory Evidence & Cache
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Securely releases active object URLs, canvases, and cached metadata from browser RAM.
            </p>
          </div>
        </div>

        {confirmPurge ? (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-xs space-y-3">
            <p className="text-red-200">
              Are you sure? This will purge the currently loaded evidence session, revoke in-memory object URLs, and reset active forensic findings.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePurge}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
              >
                Yes, Purge Memory Now
              </button>
              <button
                onClick={() => setConfirmPurge(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmPurge(true)}
            className="px-4 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 text-xs font-bold transition cursor-pointer"
          >
            Purge Session Evidence
          </button>
        )}
      </div>
    </div>
  );
};
