import React, { useState } from 'react';
import {
  FolderArchive,
  Plus,
  Briefcase,
  User,
  Building,
  Calendar,
  CheckCircle,
  FileImage,
  Clock,
  Edit2,
  Save,
} from 'lucide-react';
import { CaseRecord, ImageForensicSession, VideoForensicSession, AudioForensicSession } from '../types/forensics';
import { Film, Mic } from 'lucide-react';

interface CasesViewProps {
  cases: CaseRecord[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
  onCreateCase: (newCase: Omit<CaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'evidenceSessionIds'>) => void;
  onUpdateCaseNotes: (caseId: string, notes: string) => void;
  currentSession: ImageForensicSession | null;
  videoSession?: VideoForensicSession | null;
  audioSession?: AudioForensicSession | null;
}

export const CasesView: React.FC<CasesViewProps> = ({
  cases,
  activeCaseId,
  onSelectCase,
  onCreateCase,
  onUpdateCaseNotes,
  currentSession,
  videoSession,
  audioSession,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newInvestigator, setNewInvestigator] = useState('');
  const [newAgency, setNewAgency] = useState('');

  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];
  const [editingNotes, setEditingNotes] = useState(activeCase?.notes || '');
  const [isNotesSaved, setIsNotesSaved] = useState(false);

  const handleSaveNotes = () => {
    if (activeCase) {
      onUpdateCaseNotes(activeCase.id, editingNotes);
      setIsNotesSaved(true);
      setTimeout(() => setIsNotesSaved(false), 2000);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newCaseNumber) return;

    onCreateCase({
      caseNumber: newCaseNumber.trim(),
      title: newTitle.trim(),
      investigator: newInvestigator.trim() || 'Senior Forensic Examiner',
      agency: newAgency.trim() || 'Digital Forensics Division',
      status: 'Open',
      notes: 'Initial case opened. Evidence intake pending.',
    });

    setIsCreating(false);
    setNewTitle('');
    setNewCaseNumber('');
    setNewInvestigator('');
    setNewAgency('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            INVESTIGATION CASE MANAGEMENT
          </span>
          <h2 className="text-xl font-bold text-slate-100 font-mono mt-0.5">
            Active Forensic Cases
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Keep evidence custody records and investigator logs isolated by case identifier.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigation Case</span>
        </button>
      </div>

      {/* Modal for creating a new case */}
      {isCreating && (
        <div className="p-6 rounded-xl bg-slate-950 border border-cyan-500/40 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider text-cyan-400">
            Open New Investigation File
          </h3>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Case Number / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FV-2026-104"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Investigation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operation DeepSight - Tampered Contract Inspection"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Assigned Investigator
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Agent R. Chen"
                  value={newInvestigator}
                  onChange={(e) => setNewInvestigator(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Agency / Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cyber Forensics & Asset Protection"
                  value={newAgency}
                  onChange={(e) => setNewAgency(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono cursor-pointer"
              >
                Initialize Case
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Cases List & Selected Case Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Case Records List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
            Available Case Files ({cases.length})
          </div>

          <div className="space-y-2.5">
            {cases.map((c) => {
              const isSelected = c.id === activeCaseId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectCase(c.id);
                    setEditingNotes(c.notes);
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-700/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {c.caseNumber}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {c.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                    {c.title}
                  </h4>

                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <span>{c.investigator}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Case Details & Chain of Custody Log (7 cols) */}
        {activeCase && (
          <div className="lg:col-span-7 rounded-xl bg-slate-900/80 border border-slate-800 p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  ACTIVE CASE DOSSIER
                </span>
                <h3 className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  {activeCase.title}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
                  <span>Case ID: {activeCase.caseNumber}</span>
                  <span>•</span>
                  <span>Lead: {activeCase.investigator}</span>
                  <span>•</span>
                  <span>Agency: {activeCase.agency}</span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                {activeCase.status}
              </span>
            </div>

            {/* Attached Evidence in Current Session */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Associated Evidence Items
              </span>

              {(!currentSession && !videoSession && !audioSession) && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-500 font-mono">
                  No evidence file currently ingested under this specific case. Switch to Dashboard, Image Forensics, Video Forensics, or Audio Forensics to load evidence into this dossier.
                </div>
              )}

              {audioSession && audioSession.caseId === activeCase.id && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <Mic className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-slate-200 font-bold">{audioSession.integrity.filename}</div>
                      <div className="text-[11px] text-slate-400">
                        {audioSession.metrics.formattedDuration} • {audioSession.container.format} • SHA-256: {audioSession.integrity.sha256.slice(0, 12)}...
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Live Audio Session
                  </span>
                </div>
              )}

              {currentSession && currentSession.caseId === activeCase.id && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <FileImage className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-slate-200 font-bold">{currentSession.integrity.filename}</div>
                      <div className="text-[11px] text-slate-400">
                        {currentSession.integrity.formattedSize} • Image • SHA-256: {currentSession.integrity.sha256.slice(0, 12)}...
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Live Image Session
                  </span>
                </div>
              )}

              {videoSession && videoSession.caseId === activeCase.id && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <Film className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-slate-200 font-bold">{videoSession.integrity.filename}</div>
                      <div className="text-[11px] text-slate-400">
                        {videoSession.integrity.formattedDuration} • {videoSession.integrity.videoCodec} • SHA-256: {videoSession.integrity.sha256.slice(0, 12)}...
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Live Video Session
                  </span>
                </div>
              )}
            </div>

            {/* Case Notes Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                  Investigator Notes & Custody Log
                </span>
                {isNotesSaved && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              <textarea
                rows={5}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Log notes, custody movements, suspect claims, or forensic observations..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotes}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-mono font-semibold transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Dossier Notes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
