import React, { useState, useRef, useEffect } from 'react';
import {
  FileCheck,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  MapPin,
  ExternalLink,
  Sliders,
  Maximize2,
  RefreshCw,
  Layers,
  Sparkles,
  AlertTriangle,
  Info,
  Split,
  Eye,
  BarChart3,
  Binary,
} from 'lucide-react';
import {
  ImageForensicSession,
  MetadataEntry,
  ElaSettings,
  ElaResult,
} from '../types/forensics';
import { performErrorLevelAnalysis } from '../utils/ela';
import { PixelInspector } from './PixelInspector';

interface ImageForensicsViewProps {
  session: ImageForensicSession | null;
  onUpdateEla: (result: ElaResult) => void;
  onOpenUpload: () => void;
}

type SubTab = 'overview' | 'metadata' | 'ela' | 'histogram' | 'stego' | 'watermark';

export const ImageForensicsView: React.FC<ImageForensicsViewProps> = ({
  session,
  onUpdateEla,
  onOpenUpload,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('metadata');

  // Metadata search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // ELA interactive state
  const [elaQuality, setElaQuality] = useState<number>(85);
  const [elaMultiplier, setElaMultiplier] = useState<number>(20);
  const [isRecomputingEla, setIsRecomputingEla] = useState(false);
  const [elaViewMode, setElaViewMode] = useState<'split' | 'side-by-side' | 'ela-only' | 'loupe'>('split');
  const [splitSliderPos, setSplitSliderPos] = useState<number>(50);

  // Steganography bit-plane selection
  const [selectedBitChannel, setSelectedBitChannel] = useState<'red' | 'green' | 'blue' | 'all'>('all');

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Handle recomputing ELA with new parameters
  const handleRecomputeEla = async () => {
    if (!session) return;
    setIsRecomputingEla(true);
    try {
      const img = new Image();
      img.onload = async () => {
        const newResult = await performErrorLevelAnalysis(img, {
          jpegQuality: elaQuality,
          scaleMultiplier: elaMultiplier,
        });
        onUpdateEla(newResult);
        setIsRecomputingEla(false);
      };
      img.src = session.previewUrl;
    } catch (err) {
      console.error('ELA computation error', err);
      setIsRecomputingEla(false);
    }
  };

  // Split slider mouse events
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSplit || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setSplitSliderPos((x / rect.width) * 100);
  };

  const copyMetadataValue = (tag: string, value: string) => {
    navigator.clipboard.writeText(`${tag}: ${value}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const exportMetadataJson = () => {
    if (!session) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session.metadata, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${session.integrity.filename}_metadata.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!session) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto mb-4">
          <Search className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 font-mono mb-2">No Evidence Loaded</h3>
        <p className="text-xs text-slate-400 mb-6">
          Please upload an image or load one of the test evidence samples to begin deep forensic examination.
        </p>
        <button
          onClick={onOpenUpload}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide transition cursor-pointer"
        >
          Load Evidence File
        </button>
      </div>
    );
  }

  const { integrity, metadata, gps, ela, histogram, stego, watermark } = session;

  // Filtered metadata
  const filteredMetadata = metadata.filter((entry) => {
    const matchesSearch =
      entry.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || entry.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Evidence Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            IMAGE FORENSICS WORKBENCH
          </span>
          <h2 className="text-lg font-bold text-slate-100 font-mono mt-0.5">
            {integrity.filename}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Format: {integrity.detectedFormat} • {integrity.width}×{integrity.height} • SHA-256: {integrity.sha256.substring(0, 16)}...
          </p>
        </div>

        {/* Sub-tab navigation pill bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          {[
            { id: 'metadata', label: 'EXIF / Metadata', icon: <Search className="w-3.5 h-3.5" /> },
            { id: 'ela', label: 'Manipulation / ELA', icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: 'histogram', label: 'Color & Histogram', icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { id: 'stego', label: 'Steganography / LSB', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'watermark', label: 'Watermarks', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'overview', label: 'Binary & Integrity', icon: <Binary className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SubTab)}
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

      {/* SUB-TAB 1: METADATA ANALYSIS */}
      {activeTab === 'metadata' && (
        <div className="space-y-4">
          {/* GPS Quick Card if available */}
          {gps.hasGps && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-900/60 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase text-cyan-300">
                    Geotag Telemetry Identified
                  </h4>
                  <p className="text-xs text-slate-200 font-mono mt-0.5">
                    Coordinates: {gps.formattedCoords} {gps.altitude ? `(Alt: ${gps.altitude})` : ''}
                  </p>
                </div>
              </div>

              {gps.googleMapsUrl && (
                <a
                  href={gps.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-cyan-200 text-xs font-mono font-semibold transition shrink-0"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Controls: Search, Category Filters, Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search metadata tags or values (e.g. Camera, ISO, Software, GPS)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Category Filter Pills & Export */}
            <div className="flex items-center gap-2 flex-wrap">
              {['ALL', 'EXIF', 'IPTC', 'XMP', 'GPS', 'ICC'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    categoryFilter === cat
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
                title="Download full extracted metadata payload as JSON"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Metadata Table */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Tag Identifier</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Standard Label</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {filteredMetadata.length > 0 ? (
                    filteredMetadata.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/50 transition">
                        <td className="py-2.5 px-4 font-semibold text-cyan-400 truncate max-w-[200px]">
                          {entry.tag}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-400">
                            {entry.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">{entry.label}</td>
                        <td className="py-2.5 px-4 text-slate-200 break-all max-w-[380px]">
                          {entry.value}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => copyMetadataValue(entry.tag, entry.value)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                            title="Copy tag and value"
                          >
                            {copiedTag === entry.tag ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                        No metadata tags found matching current query or category filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>Showing {filteredMetadata.length} of {metadata.length} extracted entries</span>
              <span>Distinguishes missing metadata from parsing errors</span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: MANIPULATION & ERROR LEVEL ANALYSIS (ELA) */}
      {activeTab === 'ela' && (
        <div className="space-y-6">
          {integrity.detectedFormat !== 'JPEG' && !integrity.mimeType.includes('jpeg') ? (
            <div className="p-5 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold font-mono text-amber-300 mb-0.5">Notice: Container is {integrity.detectedFormat}</h4>
                <p className="leading-relaxed">
                  Standard Error Level Analysis (ELA) relies specifically on the discrete cosine transform (DCT) 8x8 block quantization tables defined in the JPEG specification. Non-JPEG files (like PNG or WebP) do not have baseline JPEG loss tables; however, you can still inspect pixel loupe, bit planes, and histogram distributions below.
                </p>
              </div>
            </div>
          ) : null}

          {/* Interactive ELA Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                {/* JPEG Quality Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Recompression Quality:</span>
                    <span className="text-cyan-400 font-bold">{elaQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="5"
                    value={elaQuality}
                    onChange={(e) => setElaQuality(Number(e.target.value))}
                    className="w-40 accent-cyan-500 cursor-pointer"
                  />
                </div>

                {/* Scale Multiplier Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Disparity Gain:</span>
                    <span className="text-cyan-400 font-bold">{elaMultiplier}x</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    step="5"
                    value={elaMultiplier}
                    onChange={(e) => setElaMultiplier(Number(e.target.value))}
                    className="w-40 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleRecomputeEla}
                  disabled={isRecomputingEla}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-mono font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecomputingEla ? 'animate-spin' : ''}`} />
                  <span>{isRecomputingEla ? 'Computing...' : 'Re-calculate ELA'}</span>
                </button>
              </div>

              {/* View Mode Selector */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                <button
                  onClick={() => setElaViewMode('split')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    elaViewMode === 'split' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Split Wipe
                </button>
                <button
                  onClick={() => setElaViewMode('side-by-side')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    elaViewMode === 'side-by-side' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setElaViewMode('ela-only')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    elaViewMode === 'ela-only' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  ELA Map Only
                </button>
                <button
                  onClick={() => setElaViewMode('loupe')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    elaViewMode === 'loupe' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Pixel Loupe
                </button>
              </div>
            </div>

            {/* Statistics Row */}
            {ela && (
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 uppercase text-[10px]">Avg Disparity</span>
                  <div className="text-slate-200 font-bold mt-0.5">{ela.averageDisparity} px</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 uppercase text-[10px]">Peak Disparity</span>
                  <div className="text-slate-200 font-bold mt-0.5">{ela.maxDisparity} px</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 uppercase text-[10px]">High Disparity Ratio</span>
                  <div className="text-cyan-400 font-bold mt-0.5">{ela.highDisparityRatio}%</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 uppercase text-[10px]">ELA Assessment</span>
                  <div
                    className={`font-bold mt-0.5 uppercase ${
                      ela.severity === 'tampered'
                        ? 'text-red-400'
                        : ela.severity === 'suspicious'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {ela.severity}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visual Presentation Canvas Container */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4">
            {elaViewMode === 'loupe' ? (
              <PixelInspector
                imageSrc={ela ? ela.elaDataUrl : session.previewUrl}
                naturalWidth={integrity.width}
                naturalHeight={integrity.height}
              />
            ) : elaViewMode === 'side-by-side' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 font-bold uppercase">
                    Original Ingested Evidence
                  </span>
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center p-2 min-h-[300px]">
                    <img src={session.previewUrl} alt="Original" className="max-h-[380px] w-auto object-contain" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono text-cyan-400 font-bold uppercase">
                    ELA Error Disparity Heatmap ({elaQuality}%, {elaMultiplier}x)
                  </span>
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center p-2 min-h-[300px]">
                    {ela ? (
                      <img src={ela.elaDataUrl} alt="ELA Map" className="max-h-[380px] w-auto object-contain" />
                    ) : (
                      <span className="text-xs font-mono text-slate-500">ELA not generated</span>
                    )}
                  </div>
                </div>
              </div>
            ) : elaViewMode === 'ela-only' ? (
              <div className="space-y-2">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase">
                  Error Level Analysis Map ({elaQuality}% Recompression, {elaMultiplier}x Gain)
                </span>
                <div className="rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center p-2 min-h-[380px]">
                  {ela ? (
                    <img src={ela.elaDataUrl} alt="ELA Map" className="max-h-[460px] w-auto object-contain" />
                  ) : (
                    <span className="text-xs font-mono text-slate-500">ELA not available</span>
                  )}
                </div>
              </div>
            ) : (
              /* Split Wipe Slider */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Drag slider or move mouse over image to compare:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Left: Original</span>
                    <span className="text-cyan-400">Right: ELA Disparity</span>
                  </div>
                </div>

                <div
                  ref={splitContainerRef}
                  onMouseDown={() => setIsDraggingSplit(true)}
                  onMouseUp={() => setIsDraggingSplit(false)}
                  onMouseMove={handleSplitMouseMove}
                  onMouseLeave={() => setIsDraggingSplit(false)}
                  className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center select-none cursor-ew-resize group"
                  style={{ minHeight: '380px', maxHeight: '500px' }}
                >
                  {/* Under layer: ELA */}
                  {ela && (
                    <img
                      src={ela.elaDataUrl}
                      alt="ELA Background"
                      className="max-h-[480px] w-auto object-contain mx-auto pointer-events-none"
                    />
                  )}

                  {/* Over layer: Original with clip path */}
                  <div
                    className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                    style={{
                      clipPath: `polygon(0 0, ${splitSliderPos}% 0, ${splitSliderPos}% 100%, 0 100%)`,
                    }}
                  >
                    <img
                      src={session.previewUrl}
                      alt="Original Foreground"
                      className="max-h-[480px] w-auto object-contain mx-auto pointer-events-none"
                    />
                  </div>

                  {/* Slider divider bar */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    style={{ left: `${splitSliderPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-md">
                      <Split className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ELA Scientific Caveats Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed font-mono">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase text-[11px]">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Scientific Methodology & Forensic Interpretation Notes</span>
            </div>
            <p>
              • <strong>Methodology:</strong> Error Level Analysis re-saves the raster at a known compression table ({elaQuality}%) and measures the difference between original and resaved 8x8 DCT quantization values.
            </p>
            <p>
              • <strong>High-Frequency Edges:</strong> Natural high-frequency edges and high-contrast lines naturally demonstrate elevated ELA error dissipation. This is standard mathematical behavior, not proof of tampering.
            </p>
            <p>
              • <strong>Tampering Indication:</strong> Spliced elements or localized modifications typically display significantly higher or lower error noise than surrounding areas of identical texture, revealing differing compression histories.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: COLOR & HISTOGRAM ANALYSIS */}
      {activeTab === 'histogram' && histogram && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
              Color Channel Distribution & Dynamic Range
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              Histograms display pixel intensity frequencies (0 to 255) across Red, Green, Blue, and Luminance. Spikes at 0 or 255 indicate sensor underexposure/shadow clipping or blown-out specular highlights.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px]">Tonal Entropy</span>
                <div className="text-cyan-300 font-bold mt-0.5">{histogram.entropy} bits</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px]">Dynamic Range</span>
                <div className="text-slate-200 font-bold mt-0.5">{histogram.dynamicRangePercent}% of gamut</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px]">Shadow Clipping (0)</span>
                <div className="text-slate-200 font-bold mt-0.5">{histogram.luminance.clippedDarkPercent}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 uppercase text-[10px]">Highlight Clipping (255)</span>
                <div className="text-slate-200 font-bold mt-0.5">{histogram.luminance.clippedLightPercent}%</div>
              </div>
            </div>
          </div>

          {/* Histogram Renderers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Luminance */}
            <ChannelHistogramCard title="Luminance (Tonal Distribution)" channel={histogram.luminance} color="#06B6D4" />
            {/* Red */}
            <ChannelHistogramCard title="Red Channel" channel={histogram.red} color="#EF4444" />
            {/* Green */}
            <ChannelHistogramCard title="Green Channel" channel={histogram.green} color="#10B981" />
            {/* Blue */}
            <ChannelHistogramCard title="Blue Channel" channel={histogram.blue} color="#3B82F6" />
          </div>
        </div>
      )}

      {/* SUB-TAB 4: STEGANOGRAPHY & BIT-PLANES */}
      {activeTab === 'stego' && stego && (
        <div className="space-y-6">
          {/* Trailing bytes anomaly card */}
          {stego.hasTrailingData ? (
            <div className="p-5 rounded-xl bg-red-950/40 border border-red-800 text-red-200 space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase text-red-300">
                    CRITICAL STRUCTURAL ANOMALY: Trailing Data Appended
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Found {stego.trailingBytesCount} bytes appended after the container terminator marker (e.g. JPEG 0xFFD9 EOI or PNG IEND chunk).
                  </p>
                </div>
              </div>

              {stego.trailingDataHexPreview && (
                <div className="mt-3">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">
                    Extracted Trailing Payload Hex & ASCII Preview:
                  </span>
                  <pre className="mt-1 p-3 rounded bg-black border border-red-900/60 font-mono text-[11px] text-red-300 overflow-x-auto select-all leading-tight">
                    {stego.trailingDataHexPreview}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold font-mono">Clean Container Bounds: </span>
                <span>No unexpected trailing bytes or append-injection found past official container markers.</span>
              </div>
            </div>
          )}

          {/* LSB Randomness & Bit-Plane Inspection */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Least Significant Bit (LSB) Plane Analysis
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluates entropy distribution across bit-planes 0 to 7. Uniform randomness (entropy ~ 1.000) indicates encrypted payloads.
                </p>
              </div>

              {/* Channel Selector */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                {(['all', 'red', 'green', 'blue'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setSelectedBitChannel(ch)}
                    className={`px-3 py-1 rounded capitalize transition cursor-pointer ${
                      selectedBitChannel === ch
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Assessment Box */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 uppercase text-[10px]">LSB Entropy Score</span>
                <span className="text-cyan-400 font-bold">{stego.lsbEntropy} / 1.000</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {stego.lsbAssessment}
              </p>
            </div>

            {/* Bit-Plane Visualizer Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stego.bitPlanes.map((bp, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border bg-slate-950 flex flex-col justify-between ${
                    bp.channel === selectedBitChannel ? 'border-cyan-500/80 ring-1 ring-cyan-500/30' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <span className="font-bold text-slate-200 capitalize">
                        Channel: {bp.channel} (Bit 0)
                      </span>
                      <span className="text-[11px] text-cyan-400 font-semibold">{bp.entropy}</span>
                    </div>

                    {bp.previewDataUrl ? (
                      <div className="rounded overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center mb-2">
                        <img
                          src={bp.previewDataUrl}
                          alt={`Bit plane ${bp.channel}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded border border-slate-800 bg-black aspect-video flex items-center justify-center text-slate-600 text-xs font-mono mb-2">
                        Bit plane raster
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <span>Noise Variance: Normal</span>
                    <span>Bit 0 (LSB)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: WATERMARKS & OVERLAYS */}
      {activeTab === 'watermark' && watermark && (
        <div className="space-y-6">
          {/* Status Header */}
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
                WATERMARK INSPECTION RESULT
              </span>
              <h3 className="text-base font-bold font-mono mt-0.5">
                Status: {watermark.status} (Confidence: {watermark.confidence}%)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Corner candidate clusters evaluated: {watermark.candidateAreasCount}
              </p>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 uppercase">
              {watermark.status}
            </span>
          </div>

          {/* Findings List */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase text-slate-200 tracking-wider">
              Diagnostic Findings & Heuristic Signals
            </h4>
            <div className="space-y-2">
              {watermark.findings.map((f, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-start gap-2.5">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations and Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase text-[11px]">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Scientific Disclosure Regarding Invisible Watermarks</span>
            </div>
            <p>{watermark.limitations}</p>
            <p className="text-slate-500 text-[11px]">
              Forensic Vision never fabricates detection certainty. Absence of detectable watermarks does not certify an image was not synthetically generated or protected by a proprietary algorithm.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: BINARY & INTEGRITY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Binary Stream Characteristics & File Identification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Magic Byte Signature</span>
                <div className="text-cyan-400 font-bold mt-1">{integrity.detectedFormat} Header Verified</div>
                <div className="text-slate-400 text-[11px] mt-0.5">{integrity.mimeType}</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Calculated Shannon Entropy</span>
                <div className="text-slate-200 font-bold mt-1">{integrity.shannonEntropy} / 8.00 bits</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  {integrity.shannonEntropy > 7.9 ? 'Dense / High Compression' : 'Standard Optical Distribution'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                <span className="text-slate-500 uppercase text-[10px]">Evidence File Size</span>
                <div className="text-slate-200 font-bold mt-1">{integrity.formattedSize}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">{integrity.fileSize.toLocaleString()} bytes</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for rendering a 256-bin histogram
const ChannelHistogramCard: React.FC<{
  title: string;
  channel: { data: number[]; mean: number; stdDev: number; min: number; max: number };
  color: string;
}> = ({ title, channel, color }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...channel.data, 1);

    ctx.fillStyle = color;
    const binWidth = width / 256;

    for (let i = 0; i < 256; i++) {
      const binHeight = (channel.data[i] / maxVal) * (height - 4);
      ctx.fillRect(i * binWidth, height - binHeight, Math.max(1, binWidth), binHeight);
    }
  }, [channel, color]);

  return (
    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-200">{title}</span>
        <span className="text-slate-400 text-[11px]">Mean: {channel.mean} • σ: {channel.stdDev}</span>
      </div>

      <div className="rounded-lg bg-black p-2 border border-slate-800">
        <canvas ref={canvasRef} width={360} height={100} className="w-full h-24 block" />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>0 (Black)</span>
        <span>128 (Midtone)</span>
        <span>255 (White)</span>
      </div>
    </div>
  );
};
