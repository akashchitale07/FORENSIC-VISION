import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, FileImage, Film, Mic } from 'lucide-react';
import { SAMPLE_EVIDENCE_LIST, SampleEvidenceItem } from '../utils/sampleEvidence';
import { SAMPLE_VIDEO_LIST, SampleVideoItem } from '../utils/sampleVideoEvidence';
import { SAMPLE_AUDIO_LIST, SampleAudioItem } from '../utils/sampleAudioEvidence';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sample: SampleEvidenceItem | SampleVideoItem | SampleAudioItem) => void;
  isAnalyzing: boolean;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
  isAnalyzing,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('audio');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Select Pre-Configured Forensic Test Evidence
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Real-time generated synthetic files with deterministic forensic artifacts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'audio' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Phase 3: Audio Samples ({SAMPLE_AUDIO_LIST.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'image' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileImage className="w-3.5 h-3.5" />
            <span>Phase 1: Image Samples ({SAMPLE_EVIDENCE_LIST.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'video' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Phase 2: Video Samples ({SAMPLE_VIDEO_LIST.length})</span>
          </button>
        </div>

        {/* Samples List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto pr-1">
          {activeTab === 'audio' ? (
            SAMPLE_AUDIO_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-700/80 hover:bg-slate-900 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {sample.category}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition line-clamp-1 mb-1">
                    {sample.filename}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {sample.description}
                  </p>

                  <div className="space-y-1 mb-4 text-[10px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-850">
                    <div className="text-cyan-400 font-bold uppercase text-[9px] mb-1">
                      Expected Diagnostic Flags:
                    </div>
                    {sample.expectedFindings.map((finding, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-600">•</span>
                        <span>{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectSample(sample);
                    onClose();
                  }}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50"
                >
                  <span>Ingest & Run Audio Forensics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : activeTab === 'image' ? (
            SAMPLE_EVIDENCE_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-700/80 hover:bg-slate-900 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {sample.category}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition line-clamp-1 mb-1">
                    {sample.filename}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {sample.description}
                  </p>

                  <div className="space-y-1 mb-4 text-[10px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-850">
                    <div className="text-cyan-400 font-bold uppercase text-[9px] mb-1">
                      Expected Diagnostic Flags:
                    </div>
                    {sample.expectedFindings.map((finding, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-600">•</span>
                        <span>{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectSample(sample);
                    onClose();
                  }}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50"
                >
                  <span>Ingest & Run Full Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            SAMPLE_VIDEO_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-700/80 hover:bg-slate-900 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {sample.category}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 font-mono group-hover:text-cyan-300 transition line-clamp-1 mb-1">
                    {sample.filename}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {sample.description}
                  </p>

                  <div className="space-y-1 mb-4 text-[10px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-850">
                    <div className="text-cyan-400 font-bold uppercase text-[9px] mb-1">
                      Expected Diagnostic Flags:
                    </div>
                    {sample.expectedFindings.map((finding, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-600">•</span>
                        <span>{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectSample(sample);
                    onClose();
                  }}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50"
                >
                  <span>Ingest & Run Full Video Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>All samples process 100% locally in browser memory</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
