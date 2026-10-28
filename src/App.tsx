import React, { useState, useEffect } from 'react';
import {
  ImageForensicSession,
  VideoForensicSession,
  CaseRecord,
  ElaSettings,
  ElaResult,
} from './types/forensics';
import { processForensicEvidence } from './utils/forensicEngine';
import { processVideoForensicEvidence } from './utils/videoEngine';
import { SAMPLE_EVIDENCE_LIST, SampleEvidenceItem } from './utils/sampleEvidence';
import { SAMPLE_VIDEO_LIST, SampleVideoItem } from './utils/sampleVideoEvidence';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ImageForensicsView } from './components/ImageForensicsView';
import { VideoForensicsView } from './components/VideoForensicsView';
import { AudioForensicsPlaceholder } from './components/AudioForensicsPlaceholder';
import { CasesView } from './components/CasesView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SampleModal } from './components/SampleModal';

const INITIAL_CASES: CaseRecord[] = [
  {
    id: 'CASE-001',
    caseNumber: 'FV-2026-088',
    title: 'Operation Apex - Digital Document & Media Triage',
    investigator: 'Special Agent M. Sterling',
    agency: 'National Cyber Forensics Laboratory',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'Open',
    notes: 'Initial intake of digital evidence from field surveillance unit. Check for metadata stripping, image splicing, and appended covert payloads.',
    evidenceSessionIds: [],
  },
  {
    id: 'CASE-002',
    caseNumber: 'FV-2026-092',
    title: 'Media Provenance & Watermark Verification Audit',
    investigator: 'Lead Analyst S. Vance',
    agency: 'Digital Rights Enforcement Group',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'In Review',
    notes: 'Authenticity audit for syndicated marketing imagery and video surveillance feeds. Verify whether stock watermarks were removed and check for abrupt frame cuts.',
    evidenceSessionIds: [],
  },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [cases, setCases] = useState<CaseRecord[]>(INITIAL_CASES);
  const [activeCaseId, setActiveCaseId] = useState<string>('CASE-001');

  // Both image and video forensic sessions are supported
  const [currentSession, setCurrentSession] = useState<ImageForensicSession | null>(null);
  const [currentVideoSession, setCurrentVideoSession] = useState<VideoForensicSession | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('Initializing analysis...');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [elaSettings, setElaSettings] = useState<ElaSettings>({
    jpegQuality: 85,
    scaleMultiplier: 20,
  });

  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);

  // Active Case object
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  // Autostart parameter support for instant headless evaluation / testing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === 'video' || params.get('video') === '1') {
      const sample = SAMPLE_VIDEO_LIST[1]; // Spliced CCTV
      sample.generateBlob().then((file) => {
        handleFileSelected(file);
      });
    } else if (params.get('autostart') === '1' || params.get('sample') === '1') {
      const sample = SAMPLE_EVIDENCE_LIST[0];
      sample.generateBlob().then((file) => {
        handleFileSelected(file);
      });
    }
  }, []);

  const handleFileSelected = async (file: File) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisProgress(0);
    setAnalysisStage('Mounting evidence stream...');

    const isVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name);

    try {
      if (isVideo) {
        // Run Phase 2 Video Forensic Pipeline
        const videoSession = await processVideoForensicEvidence(
          file,
          activeCase.id,
          0.5,
          (stage: string, progress: number) => {
            setAnalysisStage(stage);
            setAnalysisProgress(progress);
          }
        );
        setCurrentVideoSession(videoSession);
        setCurrentTab('video-forensics');
        setIsAnalyzing(false);
      } else {
        // Run Phase 1 Image Forensic Pipeline
        const session = await processForensicEvidence(
          file,
          activeCase.id,
          elaSettings,
          (stage: string, progress: number) => {
            setAnalysisStage(stage);
            setAnalysisProgress(progress);
          }
        );
        setCurrentSession(session);
        setCurrentTab('image-forensics');
        setIsAnalyzing(false);
      }
    } catch (err: unknown) {
      console.error('Forensic processing failed', err);
      const msg = err instanceof Error ? err.message : 'Unknown forensic analysis error occurred.';
      setErrorMessage(msg);
      setIsAnalyzing(false);
    }
  };

  const handleSelectSample = async (sample: SampleEvidenceItem | SampleVideoItem) => {
    try {
      const file = await sample.generateBlob();
      await handleFileSelected(file);
    } catch (err: unknown) {
      console.error('Failed to generate sample', err);
    }
  };

  const handleResetSession = () => {
    if (currentSession?.previewUrl) {
      URL.revokeObjectURL(currentSession.previewUrl);
    }
    if (currentVideoSession?.videoBlobUrl) {
      URL.revokeObjectURL(currentVideoSession.videoBlobUrl);
    }
    setCurrentSession(null);
    setCurrentVideoSession(null);
    setErrorMessage(null);
  };

  const handleUpdateEla = (newEla: ElaResult) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      ela: newEla,
      overallSeverity:
        newEla.severity === 'tampered'
          ? 'tampered'
          : newEla.severity === 'suspicious' && currentSession.overallSeverity !== 'tampered'
          ? 'suspicious'
          : currentSession.overallSeverity,
    });
  };

  const handleCreateCase = (
    newCaseData: Omit<CaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'evidenceSessionIds'>
  ) => {
    const newCase: CaseRecord = {
      ...newCaseData,
      id: `CASE-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidenceSessionIds: [],
    };
    setCases((prev) => [newCase, ...prev]);
    setActiveCaseId(newCase.id);
  };

  const handleUpdateCaseNotes = (caseId: string, notes: string) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, notes, updatedAt: new Date().toISOString() } : c))
    );
  };

  const handleUpdateAnalystNotes = (notes: string) => {
    if (currentSession) {
      setCurrentSession({ ...currentSession, analystNotes: notes });
    }
    if (currentVideoSession) {
      setCurrentVideoSession({ ...currentVideoSession, analystNotes: notes });
    }
  };

  const handlePurgeAllEvidence = () => {
    handleResetSession();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar
        currentSession={currentSession}
        currentVideoSession={currentVideoSession}
        activeCase={activeCase}
        onResetSession={handleResetSession}
        onLoadSample={() => setIsSampleModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          currentSession={currentSession}
          currentVideoSession={currentVideoSession}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-950/60">
          {currentTab === 'dashboard' && (
            <DashboardView
              session={currentSession}
              videoSession={currentVideoSession}
              activeCase={activeCase}
              onFileSelected={handleFileSelected}
              isAnalyzing={isAnalyzing}
              analysisStage={analysisStage}
              analysisProgress={analysisProgress}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage(null)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'image-forensics' && (
            <ImageForensicsView
              session={currentSession}
              onUpdateEla={handleUpdateEla}
              onOpenUpload={() => setCurrentTab('dashboard')}
            />
          )}

          {currentTab === 'video-forensics' && (
            <VideoForensicsView
              session={currentVideoSession}
              onOpenUpload={() => setCurrentTab('dashboard')}
            />
          )}

          {currentTab === 'audio-forensics' && <AudioForensicsPlaceholder />}

          {currentTab === 'cases' && (
            <CasesView
              cases={cases}
              activeCaseId={activeCaseId}
              onSelectCase={setActiveCaseId}
              onCreateCase={handleCreateCase}
              onUpdateCaseNotes={handleUpdateCaseNotes}
              currentSession={currentSession}
              videoSession={currentVideoSession}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              session={currentSession}
              videoSession={currentVideoSession}
              activeCase={activeCase}
              onUpdateAnalystNotes={handleUpdateAnalystNotes}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              elaSettings={elaSettings}
              onUpdateElaSettings={setElaSettings}
              onPurgeAllEvidence={handlePurgeAllEvidence}
            />
          )}
        </main>
      </div>

      {/* Sample Evidence Selection Modal */}
      <SampleModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSample={handleSelectSample}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
}
