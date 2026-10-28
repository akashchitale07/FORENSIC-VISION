import React, { useState, useRef } from 'react';
import { Upload, FileImage, Film, Mic, AlertTriangle, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { SAMPLE_EVIDENCE_LIST, SampleEvidenceItem } from '../utils/sampleEvidence';
import { SAMPLE_VIDEO_LIST, SampleVideoItem } from '../utils/sampleVideoEvidence';
import { SAMPLE_AUDIO_LIST, SampleAudioItem } from '../utils/sampleAudioEvidence';

interface UploadAreaProps {
  onFileSelected: (file: File) => void;
  isAnalyzing: boolean;
  analysisStage?: string;
  analysisProgress?: number;
  errorMessage?: string | null;
  onClearError: () => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFileSelected,
  isAnalyzing,
  analysisStage = 'Initializing analysis...',
  analysisProgress = 0,
  errorMessage,
  onClearError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sampleTab, setSampleTab] = useState<'image' | 'video' | 'audio'>('audio');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onClearError();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSubmit(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSubmit(file);
    }
  };

  const validateAndSubmit = (file: File) => {
    const validImageExts = /\.(jpe?g|png|webp|tiff?)$/i;
    const validVideoExts = /\.(mp4|mov|webm|mkv)$/i;
    const validAudioExts = /\.(wav|mp3|m4a|aac|flac|ogg|webm)$/i;
    const validMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/x-tiff',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-matroska',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      'audio/flac',
      'audio/ogg',
      'audio/webm',
    ];

    const isImage = validImageExts.test(file.name) || file.type.startsWith('image/');
    const isVideo = validVideoExts.test(file.name) || file.type.startsWith('video/');
    const isAudio = validAudioExts.test(file.name) || file.type.startsWith('audio/');

    if (!isImage && !isVideo && !isAudio && !validMimes.includes(file.type)) {
      alert('Unsupported file format. Please upload JPG, PNG, WebP, TIFF, MP4, MOV, WebM, WAV, MP3, FLAC, M4A, or OGG evidence.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('File exceeds 100MB evidence size limit.');
      return;
    }

    onFileSelected(file);
  };

  const handleLoadSample = async (sample: SampleEvidenceItem | SampleVideoItem | SampleAudioItem) => {
    onClearError();
    try {
      const file = await sample.generateBlob();
      onFileSelected(file);
    } catch (err) {
      console.error('Failed to load sample', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.mp4,.mov,.webm,.mkv,.wav,.mp3,.m4a,.aac,.flac,.ogg,image/*,video/*,audio/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isAnalyzing}
        />

        {isAnalyzing ? (
          <div className="py-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 font-mono mb-1">
              Analyzing Evidence...
            </h3>
            <p className="text-xs text-cyan-300 font-mono mb-4 max-w-md">
              {analysisStage}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-md bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800 p-0.5">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-2">
              {analysisProgress}% completed
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                <FileImage className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                <Film className="w-6 h-6 text-cyan-400" />
              </div>
            </div>

            <h3 className="text-base font-semibold text-slate-200 mb-1">
              Ingest Audio, Image, or Video Digital Evidence
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              Drag and drop an audio, image, or video file here, or click browse to import evidence into the local memory sandbox. Original files are preserved strictly as read-only.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide transition shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Browse Evidence File</span>
            </button>

            {/* Supported Formats */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-[11px] font-mono text-slate-500">
              <span className="text-slate-400">Supported Containers:</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">JPG / JPEG</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">PNG</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">WEBP</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">TIFF</span>
              <span className="text-cyan-500">|</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-800/80 text-cyan-300">MP4</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-800/80 text-cyan-300">MOV</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-800/80 text-cyan-300">WEBM</span>
              <span className="text-slate-400">| Max: 100MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Error message if any */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-300 mb-0.5">Forensic Ingestion Error</h4>
            <p className="text-slate-300">{errorMessage}</p>
          </div>
          <button
            onClick={onClearError}
            className="text-red-400 hover:text-red-200 text-xs font-mono font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pre-configured Forensic Test Samples */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
              Pre-Configured Forensic Test Evidence
            </h4>
          </div>

          {/* Sample Type Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setSampleTab('audio')}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                sampleTab === 'audio' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Phase 3: Audio ({SAMPLE_AUDIO_LIST.length})</span>
            </button>
            <button
              onClick={() => setSampleTab('image')}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                sampleTab === 'image' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
              }`}
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>Phase 1: Image ({SAMPLE_EVIDENCE_LIST.length})</span>
            </button>
            <button
              onClick={() => setSampleTab('video')}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                sampleTab === 'video' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800' : 'text-slate-400'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Phase 2: Video ({SAMPLE_VIDEO_LIST.length})</span>
            </button>
          </div>
        </div>

        {sampleTab === 'audio' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SAMPLE_AUDIO_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-cyan-800/70 hover:bg-slate-950 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                      {sample.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-200 font-mono mb-1 group-hover:text-cyan-300 transition line-clamp-1">
                    {sample.filename}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-3">
                    {sample.description}
                  </p>
                </div>

                <button
                  onClick={() => handleLoadSample(sample)}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <span>Load Audio Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : sampleTab === 'image' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_EVIDENCE_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-cyan-800/70 hover:bg-slate-950 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                      {sample.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-200 font-mono mb-1 group-hover:text-cyan-300 transition line-clamp-1">
                    {sample.filename}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-3">
                    {sample.description}
                  </p>
                </div>

                <button
                  onClick={() => handleLoadSample(sample)}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <span>Load Image Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SAMPLE_VIDEO_LIST.map((sample) => (
              <div
                key={sample.id}
                className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-cyan-800/70 hover:bg-slate-950 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                      {sample.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-200 font-mono mb-1 group-hover:text-cyan-300 transition line-clamp-1">
                    {sample.filename}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-3">
                    {sample.description}
                  </p>
                </div>

                <button
                  onClick={() => handleLoadSample(sample)}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <span>Load Video Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
