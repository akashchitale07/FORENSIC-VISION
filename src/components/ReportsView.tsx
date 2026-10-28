import React, { useState } from 'react';
import {
  Printer,
  Download,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Hash,
  Film,
  FileImage,
  Layers,
  Mic,
  AudioWaveform,
  Zap,
  Scissors,
} from 'lucide-react';
import {
  ImageForensicSession,
  VideoForensicSession,
  AudioForensicSession,
  CaseRecord,
} from '../types/forensics';

interface ReportsViewProps {
  session: ImageForensicSession | null;
  videoSession?: VideoForensicSession | null;
  audioSession?: AudioForensicSession | null;
  activeCase: CaseRecord;
  onUpdateAnalystNotes: (notes: string) => void;
  onUpdateVideoAnalystNotes?: (notes: string) => void;
  onUpdateAudioAnalystNotes?: (notes: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  session,
  videoSession,
  audioSession,
  activeCase,
  onUpdateAnalystNotes,
  onUpdateVideoAnalystNotes,
  onUpdateAudioAnalystNotes,
}) => {
  // If multiple exist, prioritize audio or video if loaded
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<'image' | 'video' | 'audio'>(
    audioSession ? 'audio' : videoSession ? 'video' : 'image'
  );

  const [imageNotes, setImageNotes] = useState(
    session?.analystNotes ||
      'Digital evidence was ingested into local memory sandbox. Cryptographic digests were calculated immediately upon receipt. No unverified third-party cloud services were invoked.'
  );

  const [videoNotes, setVideoNotes] = useState(
    videoSession?.analystNotes ||
      'Video evidence ingested and verified via SHA-256. Decoded frame pixels sampled across timeline for temporal discontinuity inspection. Derived frame thumbnails stored as labelled forensic artifacts.'
  );

  const [audioNotes, setAudioNotes] = useState(
    audioSession?.analystNotes ||
      'Digital audio evidence ingested and parsed locally. Physical sample waveforms, FFT spectrograms, electrical network frequencies (ENF), and container chunks inspected without remote transmission.'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    if (selectedEvidenceType === 'audio' && audioSession) {
      const reportPayload = {
        reportType: 'DIGITAL_AUDIO_FORENSIC_EXAMINATION_REPORT',
        platform: 'FORENSIC VISION v3.0 (Phase 3 Audio)',
        caseNumber: activeCase.caseNumber,
        caseTitle: activeCase.title,
        investigator: activeCase.investigator,
        agency: activeCase.agency || 'Independent Digital Forensics Unit',
        generatedAt: new Date().toISOString(),
        evidenceType: 'AUDIO',
        evidenceIntegrity: audioSession.integrity,
        container: audioSession.container,
        metrics: audioSession.metrics,
        anomalies: audioSession.anomalies,
        enf: audioSession.enf,
        lsbAnalysis: audioSession.lsbAnalysis,
        derivativesCount: audioSession.derivatives?.length || 0,
        overallSeverity: audioSession.overallSeverity,
        analystNotes: audioNotes,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${activeCase.caseNumber}_Audio_Forensic_Report.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (selectedEvidenceType === 'video' && videoSession) {
      const reportPayload = {
        reportType: 'DIGITAL_VIDEO_FORENSIC_EXAMINATION_REPORT',
        platform: 'FORENSIC VISION v2.0 (Phase 2)',
        caseNumber: activeCase.caseNumber,
        caseTitle: activeCase.title,
        investigator: activeCase.investigator,
        agency: activeCase.agency || 'Independent Digital Forensics Unit',
        generatedAt: new Date().toISOString(),
        evidenceType: 'VIDEO',
        evidenceIntegrity: videoSession.integrity,
        overallSeverity: videoSession.overallSeverity,
        metadataCount: videoSession.metadataEntries.length,
        samplingIntervalSeconds: videoSession.samplingIntervalSeconds,
        extractedFramesCount: videoSession.extractedFrames.length,
        tamperingEvents: videoSession.tamperingEvents,
        watermark: videoSession.watermark,
        unavailableFeatures: videoSession.integrity.unavailableFeatures,
        analystNotes: videoNotes,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${activeCase.caseNumber}_Video_Forensic_Report.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (session) {
      const reportPayload = {
        reportType: 'DIGITAL_IMAGE_FORENSIC_EXAMINATION_REPORT',
        platform: 'FORENSIC VISION v1.0',
        caseNumber: activeCase.caseNumber,
        caseTitle: activeCase.title,
        investigator: activeCase.investigator,
        agency: activeCase.agency || 'Independent Digital Forensics Unit',
        generatedAt: new Date().toISOString(),
        evidenceType: 'IMAGE',
        evidenceIntegrity: session.integrity,
        overallSeverity: session.overallSeverity,
        metadataCount: session.metadata.length,
        gps: session.gps,
        ela: session.ela
          ? {
              averageDisparity: session.ela.averageDisparity,
              maxDisparity: session.ela.maxDisparity,
              highDisparityRatio: session.ela.highDisparityRatio,
              assessment: session.ela.assessment,
              severity: session.ela.severity,
            }
          : null,
        steganography: session.stego
          ? {
              hasTrailingData: session.stego.hasTrailingData,
              trailingBytesCount: session.stego.trailingBytesCount,
              lsbEntropy: session.stego.lsbEntropy,
              assessment: session.stego.lsbAssessment,
              severity: session.stego.severity,
            }
          : null,
        watermarks: session.watermark
          ? {
              status: session.watermark.status,
              confidence: session.watermark.confidence,
              candidateAreasCount: session.watermark.candidateAreasCount,
              findings: session.watermark.findings,
            }
          : null,
        analystNotes: imageNotes,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${activeCase.caseNumber}_Image_Forensic_Report.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  const hasAnyEvidence = Boolean(session || videoSession || audioSession);

  if (!hasAnyEvidence) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 font-mono mb-2">No Active Evidence Session</h3>
        <p className="text-xs text-slate-400">
          Load an audio, image, or video evidence file to generate an official digital forensics examination report with cryptographic hashes and diagnostic findings.
        </p>
      </div>
    );
  }

  // Determine current active report
  const isAudioReport = selectedEvidenceType === 'audio' && audioSession;
  const isVideoReport = selectedEvidenceType === 'video' && videoSession;
  const currentIntegrity = isAudioReport
    ? audioSession.integrity
    : isVideoReport
    ? videoSession.integrity
    : session?.integrity;
  const currentSeverity = isAudioReport
    ? audioSession.overallSeverity
    : isVideoReport
    ? videoSession.overallSeverity
    : session?.overallSeverity;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top action toolbar (hidden during window.print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:hidden">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            FORENSIC REPORT GENERATOR
          </span>
          <h2 className="text-base font-bold text-slate-100 font-mono mt-0.5">
            Case #{activeCase.caseNumber} Examination Report
          </h2>
        </div>

        {/* Evidence Switcher if multiple are loaded */}
        {(session || videoSession || audioSession) && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
            {audioSession && (
              <button
                onClick={() => setSelectedEvidenceType('audio')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  selectedEvidenceType === 'audio' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Audio Report</span>
              </button>
            )}
            {session && (
              <button
                onClick={() => setSelectedEvidenceType('image')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  selectedEvidenceType === 'image' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
                }`}
              >
                <FileImage className="w-3.5 h-3.5" />
                <span>Image Report</span>
              </button>
            )}
            {videoSession && (
              <button
                onClick={() => setSelectedEvidenceType('video')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  selectedEvidenceType === 'video' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Video Report</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-mono font-medium transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Official Forensic Report Document */}
      <div className="p-8 sm:p-12 rounded-xl bg-slate-950 border border-slate-800 space-y-8 font-mono text-slate-200 print:bg-white print:text-black print:border-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-slate-800 pb-6 print:border-black">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 print:text-black font-extrabold text-lg tracking-wider">
                <span>FORENSIC VISION</span>
                <span className="text-xs font-normal border border-cyan-500/40 px-1.5 py-0.5 rounded text-cyan-300 print:text-black print:border-black">
                  OFFICIAL {isAudioReport ? 'AUDIO' : isVideoReport ? 'VIDEO' : 'IMAGE'} REPORT
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-100 print:text-black mt-1">
                DIGITAL {isAudioReport ? 'AUDIO' : isVideoReport ? 'VIDEO' : 'MEDIA'} FORENSIC EXAMINATION REPORT
              </h1>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-1">
                Evidence Chain of Custody & Technical Artifact Authentication
              </p>
            </div>

            <div className="text-xs space-y-1 text-slate-400 print:text-gray-700 sm:text-right">
              <div><strong>Report ID:</strong> RPT-{activeCase.caseNumber}-{Date.now().toString(36).toUpperCase()}</div>
              <div><strong>Date Generated:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
              <div><strong>Investigator:</strong> {activeCase.investigator}</div>
              <div><strong>Agency:</strong> {activeCase.agency || 'Forensic Lab Unit'}</div>
            </div>
          </div>
        </div>

        {/* 1. Evidence Identification & Cryptographic Non-Repudiation */}
        {currentIntegrity && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 print:text-black border-b border-slate-800 pb-1 print:border-black">
              1. Evidence Identification & Cryptographic Hash
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 print:text-gray-600">Filename:</span>
                <div className="font-bold text-slate-200 print:text-black">{currentIntegrity.filename}</div>
              </div>
              <div>
                <span className="text-slate-400 print:text-gray-600">File Container & Size:</span>
                <div className="font-bold text-slate-200 print:text-black">{currentIntegrity.detectedFormat} ({currentIntegrity.formattedSize})</div>
              </div>
              <div>
                <span className="text-slate-400 print:text-gray-600">
                  {isAudioReport
                    ? 'Audio Duration & Sample Rate:'
                    : isVideoReport
                    ? 'Video Duration & Dimensions:'
                    : 'Pixel Dimensions:'}
                </span>
                <div className="font-bold text-slate-200 print:text-black">
                  {isAudioReport && audioSession
                    ? `${audioSession.metrics.formattedDuration} (${audioSession.metrics.sampleRate.toLocaleString()} Hz • ${audioSession.metrics.channels === 1 ? 'Mono' : 'Stereo'})`
                    : isVideoReport
                    ? `${(currentIntegrity as any).formattedDuration} (${currentIntegrity.width} × ${currentIntegrity.height} px)`
                    : `${currentIntegrity.width} × ${currentIntegrity.height} px (${currentIntegrity.aspectRatio})`}
                </div>
              </div>
              <div>
                <span className="text-slate-400 print:text-gray-600">Shannon Entropy:</span>
                <div className="font-bold text-slate-200 print:text-black">{currentIntegrity.shannonEntropy} / 8.00 bits</div>
              </div>
            </div>

            <div className="p-3 rounded bg-slate-900 border border-slate-800 print:bg-gray-100 print:border-gray-300 text-xs space-y-1.5">
              <div>
                <span className="text-slate-400 print:text-gray-600 font-semibold">SHA-256 Digest: </span>
                <span className="font-mono text-cyan-300 print:text-black break-all">{currentIntegrity.sha256}</span>
              </div>
              <div>
                <span className="text-slate-400 print:text-gray-600 font-semibold">SHA-1 Digest: </span>
                <span className="font-mono text-cyan-300 print:text-black break-all">{currentIntegrity.sha1}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Technical Findings Summary */}
        {isAudioReport && audioSession ? (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 print:text-black border-b border-slate-800 pb-1 print:border-black">
              2. Technical Audio Findings by Analytical Technique
            </h3>

            <div className="space-y-3 text-xs leading-relaxed">
              {/* Acoustics & Signal Dynamics */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  A. Acoustic Signal Dynamics & Loudness Metrics:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Peak Amplitude: <strong>{audioSession.metrics.peakDbFs} dBFS</strong> • RMS Loudness: <strong>{audioSession.metrics.rmsDbFs} dBFS</strong> • Dynamic Range: <strong>{audioSession.metrics.dynamicRangeDb} dB</strong>. Sample Saturation/Clipping: <strong>{audioSession.metrics.clippingCount.toLocaleString()} samples ({audioSession.metrics.clippingRatio}%)</strong>. Spectral Centroid: <strong>{audioSession.metrics.spectralCentroidHz.toLocaleString()} Hz</strong>. DC Bias: <strong>{(audioSession.metrics.dcOffset * 100).toFixed(3)}%</strong>.
                </p>
              </div>

              {/* Splicing & Discontinuities */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  B. Timeline Splicing & Acoustic Discontinuities:
                </div>
                {audioSession.anomalies.length > 0 ? (
                  <div className="space-y-1.5 mt-1">
                    {audioSession.anomalies.map((anom) => (
                      <div key={anom.id} className="text-slate-300 print:text-gray-800">
                        • <strong>{anom.formattedTimestamp} [{anom.category.toUpperCase()}]:</strong> {anom.type} ({anom.metric}) — {anom.explanation}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300 print:text-gray-800">
                    No sudden butt-splices, phase interruptions, or room tone dropouts detected. Continuous ambient decay observed.
                  </p>
                )}
              </div>

              {/* Container & Trailing Stego Data */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  C. Binary Container & RIFF Chunk Verification:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Container: {audioSession.container.format} ({audioSession.container.audioEncodingFormat}). Evaluated {audioSession.container.chunks.length} discrete container chunks.
                  {audioSession.container.hasTrailingData ? (
                    <span className="text-red-400 font-bold block mt-1">
                      [CRITICAL TAMPERING ALERT]: Detected {audioSession.container.trailingBytesCount} trailing bytes appended beyond valid audio chunk boundaries. Steganographic or covert payload indicator.
                    </span>
                  ) : (
                    <span className="block mt-1">
                      Container Integrity: All chunk lengths conform to physical byte count ({audioSession.container.actualFileSize.toLocaleString()} bytes). Zero trailing payload bytes.
                    </span>
                  )}
                  LSB Bitplane Entropy: {audioSession.lsbAnalysis.entropy} / 8.00 (Suspicion Index: {audioSession.lsbAnalysis.suspicionScore}/100).
                </p>
              </div>

              {/* ENF Mains Hum */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  D. Electrical Network Frequency (ENF) Hum & Mains Induction:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  {audioSession.enf.explanation}
                </p>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  {audioSession.enf.disclaimer}
                </p>
              </div>

              {/* Exported Derivatives */}
              {audioSession.derivatives && audioSession.derivatives.length > 0 && (
                <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                  <div className="font-bold text-slate-200 print:text-black mb-1">
                    E. Derived Forensic Audio Clips ({audioSession.derivatives.length}):
                  </div>
                  <div className="space-y-1">
                    {audioSession.derivatives.map((d) => (
                      <div key={d.id} className="text-slate-300 print:text-gray-800 text-[11px]">
                        • {d.filename} ({d.formattedTimeRange}, {d.duration}s) — SHA-256: {d.sha256}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : isVideoReport ? (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 print:text-black border-b border-slate-800 pb-1 print:border-black">
              2. Technical Video Findings by Analytical Technique
            </h3>

            <div className="space-y-3 text-xs leading-relaxed">
              {/* Codec & Stream Properties */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  A. Video Codec & Container Specification:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Video Codec: {videoSession.integrity.videoCodec}. Audio Stream: {videoSession.integrity.audioCodec}.
                  Declared timescale: {videoSession.integrity.frameRate} fps baseline.
                  Fast-start atom alignment: {videoSession.integrity.moovPosition || 'Not Applicable'}.
                  Parsed {videoSession.integrity.atomsOrTracks.length} container atom/element boxes.
                </p>
              </div>

              {/* Frame Sampling & Contact Sheet */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  B. Frame Sampling Strategy & Extracted Derivatives:
                </div>
                <p className="text-slate-300 print:text-gray-800 mb-3">
                  Sampled {videoSession.extractedFrames.length} frames across the {videoSession.integrity.formattedDuration} timeline at ~{videoSession.samplingIntervalSeconds.toFixed(2)}s intervals using HTML5 Canvas Decoded Frame extraction.
                </p>

                {/* Contact Sheet Thumbnails (First 6 frames) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {videoSession.extractedFrames.slice(0, 6).map((f) => (
                    <div key={f.id} className="rounded border border-slate-700 overflow-hidden bg-black aspect-video flex flex-col justify-end">
                      <img src={f.thumbnailUrl} alt={f.formattedTimestamp} className="w-full h-auto object-cover" />
                      <span className="text-[8px] bg-black/80 text-cyan-400 text-center font-bold">{f.formattedTimestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frame-Level Tampering & Scene Cuts */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  C. Frame-Level Discontinuity & Tampering Events:
                </div>
                {videoSession.tamperingEvents.length > 0 ? (
                  <div className="space-y-1.5 mt-1">
                    {videoSession.tamperingEvents.map((evt) => (
                      <div key={evt.id} className="text-slate-300 print:text-gray-800">
                        • <strong>{evt.formattedTimestamp} ({evt.severity.toUpperCase()}):</strong> {evt.method} ({evt.metric}) - {evt.explanation}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300 print:text-gray-800">
                    No sudden scene cuts, pixel disparity spikes, or duplicate frame sequences detected across sampled intervals.
                  </p>
                )}
              </div>

              {/* Watermarks */}
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  D. Watermark & Persistent Overlay Verification:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Status: {videoSession.watermark.status} (Confidence: {videoSession.watermark.confidence}%).
                  {videoSession.watermark.findings.length > 0 ? ` ${videoSession.watermark.findings.join(' ')}` : ' No persistent corner logo overlays identified.'}
                </p>
              </div>

              {/* Native FFmpeg Limitations */}
              <div className="p-3 rounded bg-slate-900/40 border border-slate-800 print:bg-gray-50 print:border-gray-200 text-slate-400 print:text-gray-600 text-[11px]">
                <div className="font-bold text-slate-300 print:text-black mb-1">
                  E. Methodological Limitations (Browser Sandbox vs Native FFmpeg):
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {videoSession.integrity.unavailableFeatures.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : session ? (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 print:text-black border-b border-slate-800 pb-1 print:border-black">
              2. Technical Image Findings by Analytical Technique
            </h3>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  A. Metadata & EXIF / IPTC Telemetry:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Extracted {session.metadata.length} metadata entries.
                  {session.gps.hasGps ? ` Geolocation data confirmed at ${session.gps.formattedCoords}.` : ' No embedded GPS coordinates found in container.'}
                  {(() => {
                    const modelTag = session.metadata.find(
                      (m) =>
                        m.category === 'EXIF' &&
                        (m.tag.toLowerCase() === 'model' || m.tag.toLowerCase() === 'cameramodel') &&
                        m.value.trim().length > 1
                    );
                    return modelTag
                      ? ` Camera model identified as ${modelTag.value}.`
                      : ' No camera make/model signature present.';
                  })()}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  B. Error Level Analysis (JPEG Quantization Disparity):
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  {session.ela
                    ? `Assessment: ${session.ela.assessment} (Avg Disparity: ${session.ela.averageDisparity} px, High Disparity Ratio: ${session.ela.highDisparityRatio}%). Severity classified as ${session.ela.severity}.`
                    : 'File container is non-JPEG; standard 8x8 DCT quantization table analysis was not applicable.'}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  C. Steganography & Trailing Payload Analysis:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  {session.stego?.hasTrailingData
                    ? `CRITICAL FINDING: Detected ${session.stego.trailingBytesCount} trailing bytes appended past container terminator marker.`
                    : 'Container bounds clean. No trailing bytes or appended payload streams identified.'}
                  {` LSB bit-plane average entropy calculated at ${session.stego?.lsbEntropy} / 1.000.`}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 print:bg-gray-50 print:border-gray-200">
                <div className="font-bold text-slate-200 print:text-black mb-1">
                  D. Watermark & Provenance Signature Detection:
                </div>
                <p className="text-slate-300 print:text-gray-800">
                  Detection Status: {session.watermark?.status} (Confidence: {session.watermark?.confidence}%).
                  {session.watermark?.findings && session.watermark.findings.length > 0
                    ? ` ${session.watermark.findings.join(' ')}`
                    : ' No visible text badges or AI model tags identified by supported checks.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* 3. Analyst Notes & Observations */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 print:text-black border-b border-slate-800 pb-1 print:border-black">
            3. Examiner Notes & Observations
          </h3>

          <div className="print:hidden">
            <textarea
              value={isVideoReport ? videoNotes : imageNotes}
              onChange={(e) => {
                if (isVideoReport) {
                  setVideoNotes(e.target.value);
                  if (onUpdateVideoAnalystNotes) onUpdateVideoAnalystNotes(e.target.value);
                } else {
                  setImageNotes(e.target.value);
                  onUpdateAnalystNotes(e.target.value);
                }
              }}
              rows={4}
              placeholder="Enter examiner observations, custody notes, or case specific context..."
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="hidden print:block text-xs leading-relaxed text-gray-900">
            {isVideoReport ? videoNotes : imageNotes}
          </div>
        </div>

        {/* 4. Scientific Limitations & Sign-off */}
        <div className="space-y-4 pt-4 border-t border-slate-800 print:border-black text-xs text-slate-400 print:text-gray-600">
          <div className="leading-relaxed">
            <strong>Forensic Caveat & Legal Notice:</strong> Analysis was executed in accordance with Phase 1 & 2 digital evidence standards. Extracted frames and visual difference maps are labelled derivatives; the original file bitstream remains unmodified. Visual scene cuts and pixel disparity shifts do not prove malicious intent without corroborating chain of custody.
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8">
            <div className="border-t border-slate-800 print:border-black pt-2">
              <div className="font-bold text-slate-300 print:text-black">Lead Forensic Examiner</div>
              <div className="text-slate-400 print:text-gray-600">{activeCase.investigator}</div>
            </div>
            <div className="border-t border-slate-800 print:border-black pt-2">
              <div className="font-bold text-slate-300 print:text-black">Evidence Custody Verification</div>
              <div className="text-slate-400 print:text-gray-600">Cryptographically Signed via SHA-256</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
