import React from 'react';
import {
  LayoutDashboard,
  Search,
  Video,
  Mic,
  FolderArchive,
  FileText,
  Settings,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { ImageForensicSession, VideoForensicSession, AudioForensicSession } from '../types/forensics';

export type NavTab =
  | 'dashboard'
  | 'image-forensics'
  | 'video-forensics'
  | 'audio-forensics'
  | 'cases'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentSession: ImageForensicSession | null;
  currentVideoSession?: VideoForensicSession | null;
  currentAudioSession?: AudioForensicSession | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentSession,
  currentVideoSession,
  currentAudioSession,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    phase?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'image-forensics',
      label: 'Image Forensics',
      icon: <Search className="w-4 h-4" />,
      badge: currentSession ? '1 Evidence' : undefined,
    },
    {
      id: 'video-forensics',
      label: 'Video Forensics',
      icon: <Video className="w-4 h-4" />,
      badge: currentVideoSession ? '1 Evidence' : undefined,
    },
    {
      id: 'audio-forensics',
      label: 'Audio Forensics',
      icon: <Mic className="w-4 h-4" />,
      badge: currentAudioSession ? '1 Evidence' : undefined,
    },
    {
      id: 'cases',
      label: 'Investigation Cases',
      icon: <FolderArchive className="w-4 h-4" />,
    },
    {
      id: 'reports',
      label: 'Forensic Reports',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const activeEvidence = currentAudioSession
    ? {
        label: 'Audio Evidence',
        severity: currentAudioSession.overallSeverity,
        name: currentAudioSession.integrity.filename,
        meta: `${currentAudioSession.metrics.formattedDuration} • ${currentAudioSession.container.format}`,
      }
    : currentVideoSession
    ? {
        label: 'Video Evidence',
        severity: currentVideoSession.overallSeverity,
        name: currentVideoSession.integrity.filename,
        meta: `${currentVideoSession.integrity.formattedDuration} • ${currentVideoSession.integrity.detectedFormat}`,
      }
    : currentSession
    ? {
        label: 'Image Evidence',
        severity: currentSession.overallSeverity,
        name: currentSession.integrity.filename,
        meta: `${currentSession.integrity.formattedSize} • ${currentSession.integrity.detectedFormat}`,
      }
    : null;

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 select-none">
      {/* Session Quick Status Card in Sidebar */}
      {activeEvidence && (
        <div className="p-4 mx-3 my-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              {activeEvidence.label}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                activeEvidence.severity === 'tampered'
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : activeEvidence.severity === 'suspicious'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {activeEvidence.severity}
            </span>
          </div>
          <p className="text-xs text-slate-200 font-mono truncate font-medium">
            {activeEvidence.name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {activeEvidence.meta}
          </p>
        </div>
      )}

      {/* Main Navigation List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold px-3 py-1">
          Forensic Modules
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.phase && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">
                  {item.phase}
                </span>
              )}

              {item.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Security & Integrity Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 mb-1 text-slate-300 font-medium">
          <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Chain of Custody Notice</span>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-400">
          Raw buffers are held in read-only memory. Digital signatures and SHA-256 digests ensure evidence non-repudiation.
        </p>
      </div>
    </aside>
  );
};
