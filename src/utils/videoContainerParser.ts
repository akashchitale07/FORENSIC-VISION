/**
 * Low-level binary container parsing for MP4/MOV (ISOBMFF) and WebM/Matroska (EBML).
 * Extracts codec FourCCs, creation dates, timescales, atom hierarchies, and track layouts.
 */

import { MetadataEntry, VideoAtomInfo } from '../types/forensics';
import { calculateShannonEntropy } from './binaryParser';

export interface VideoContainerInspection {
  detectedFormat: 'MP4' | 'MOV' | 'WEBM' | 'MKV' | 'UNKNOWN';
  mimeType: string;
  majorBrand?: string;
  compatibleBrands?: string[];
  timescale?: number;
  containerDurationSec?: number;
  creationDate?: string;
  modificationDate?: string;
  videoCodecFourCC?: string;
  audioCodecFourCC?: string;
  hasAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  trackWidth?: number;
  trackHeight?: number;
  rotation?: number;
  moovPosition?: 'before_mdat (fast-start / web-optimized)' | 'after_mdat (standard)' | 'not_applicable';
  shannonEntropy: number;
  atomsOrTracks: VideoAtomInfo[];
  metadataEntries: MetadataEntry[];
  anomalies: string[];
  unavailableFeatures: string[];
}

export function formatVideoTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export function parseVideoContainer(buffer: ArrayBuffer): VideoContainerInspection {
  const bytes = new Uint8Array(buffer);
  const entropy = calculateShannonEntropy(bytes.slice(0, Math.min(bytes.length, 1048576))); // Sample up to 1MB for entropy
  const atomsOrTracks: VideoAtomInfo[] = [];
  const metadataEntries: MetadataEntry[] = [];
  const anomalies: string[] = [];

  const unavailableFeatures: string[] = [
    'GOP Structure & B-Frame Quantization: Requires native demuxer (FFmpeg/libavcodec)',
    'Motion Vector Field Analysis: Codec internals not exposed by HTML5 video sandbox',
    'Encoder Macroblock Boundary Maps: Unavailable without specialized C++ demuxing pipeline',
  ];

  let detectedFormat: 'MP4' | 'MOV' | 'WEBM' | 'MKV' | 'UNKNOWN' = 'UNKNOWN';
  let mimeType = 'video/mp4';
  let majorBrand: string | undefined;
  let compatibleBrands: string[] = [];
  let timescale: number | undefined;
  let containerDurationSec: number | undefined;
  let creationDate: string | undefined;
  let modificationDate: string | undefined;
  let videoCodecFourCC: string | undefined;
  let audioCodecFourCC: string | undefined;
  let hasAudio = false;
  let audioChannels: number | undefined;
  let audioSampleRate: number | undefined;
  let trackWidth: number | undefined;
  let trackHeight: number | undefined;
  let rotation = 0;
  let moovOffset = -1;
  let mdatOffset = -1;

  // 1. Signature Check
  // Check MP4/MOV: offset 4 is usually 'ftyp', 'moov', 'mdat', or 'wide'
  const isMp4 =
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70; // 'ftyp'

  // Check WebM / Matroska EBML ID: 0x1A 0x45 0xDF 0xA3
  const isEbml =
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;

  if (isMp4) {
    detectedFormat = 'MP4';
    mimeType = 'video/mp4';

    let offset = 0;
    while (offset + 8 <= bytes.length) {
      let size =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];

      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      if (size === 1 && offset + 16 <= bytes.length) {
        // 64-bit extended size
        const hi =
          (bytes[offset + 8] << 24) |
          (bytes[offset + 9] << 16) |
          (bytes[offset + 10] << 8) |
          bytes[offset + 11];
        const lo =
          (bytes[offset + 12] << 24) |
          (bytes[offset + 13] << 16) |
          (bytes[offset + 14] << 8) |
          bytes[offset + 15];
        size = hi * 4294967296 + lo;
      }

      if (size <= 0) {
        // Extends to EOF or corrupt
        size = bytes.length - offset;
      }

      atomsOrTracks.push({
        name: `Box: ${type}`,
        offset,
        size,
      });

      if (type === 'ftyp') {
        if (offset + 12 <= bytes.length) {
          majorBrand = String.fromCharCode(
            bytes[offset + 8],
            bytes[offset + 9],
            bytes[offset + 10],
            bytes[offset + 11]
          ).trim();

          if (majorBrand.toLowerCase().includes('qt')) {
            detectedFormat = 'MOV';
            mimeType = 'video/quicktime';
          }

          metadataEntries.push({
            tag: 'MajorBrand',
            label: 'ISOBMFF Major Brand',
            value: majorBrand,
            category: 'CONTAINER',
            description: 'Declared base media container specification',
          });

          // Read compatible brands
          const compBrands: string[] = [];
          for (let b = offset + 16; b + 4 <= offset + size && b + 4 <= bytes.length; b += 4) {
            const cb = String.fromCharCode(bytes[b], bytes[b + 1], bytes[b + 2], bytes[b + 3]).trim();
            if (cb) compBrands.push(cb);
          }
          compatibleBrands = compBrands;
          if (compBrands.length > 0) {
            metadataEntries.push({
              tag: 'CompatibleBrands',
              label: 'Compatible Container Profiles',
              value: compBrands.join(', '),
              category: 'CONTAINER',
            });
          }
        }
      } else if (type === 'moov') {
        moovOffset = offset;
        parseMoovBox(bytes, offset, size, {
          onMvhd: (ts, dur, cDate, mDate) => {
            timescale = ts;
            containerDurationSec = dur;
            creationDate = cDate;
            modificationDate = mDate;
            if (ts) {
              metadataEntries.push({
                tag: 'Timescale',
                label: 'Container Clock Timescale',
                value: `${ts} units/sec`,
                category: 'CONTAINER',
              });
            }
            if (dur !== undefined) {
              metadataEntries.push({
                tag: 'ContainerDuration',
                label: 'Atom Header Duration',
                value: `${dur.toFixed(3)}s (${formatVideoTimestamp(dur)})`,
                category: 'CONTAINER',
              });
            }
            if (cDate) {
              metadataEntries.push({
                tag: 'CreationDate',
                label: 'Encoded Creation Date',
                value: cDate,
                category: 'EXIF',
              });
            }
          },
          onTrak: (w, h, rot, isAudio, codec) => {
            if (w && h) {
              trackWidth = w;
              trackHeight = h;
              metadataEntries.push({
                tag: 'TrackDimensions',
                label: 'Video Track Matrix Dimensions',
                value: `${w} × ${h}`,
                category: 'TRACK',
              });
            }
            if (rot !== undefined && rot !== 0) {
              rotation = rot;
              metadataEntries.push({
                tag: 'Rotation',
                label: 'Matrix Orientation Angle',
                value: `${rot}°`,
                category: 'TRACK',
              });
            }
            if (isAudio) {
              hasAudio = true;
              if (codec) {
                audioCodecFourCC = codec;
                metadataEntries.push({
                  tag: 'AudioCodecFourCC',
                  label: 'Audio Stream Codec',
                  value: codec,
                  category: 'CODEC',
                });
              }
            } else if (codec) {
              videoCodecFourCC = codec;
              metadataEntries.push({
                tag: 'VideoCodecFourCC',
                label: 'Video Stream Codec FourCC',
                value: codec,
                category: 'CODEC',
              });
            }
          },
        });
      } else if (type === 'mdat') {
        mdatOffset = offset;
      }

      offset += size;
    }
  } else if (isEbml) {
    detectedFormat = 'WEBM';
    mimeType = 'video/webm';

    // Parse basic EBML elements
    const ebmlInfo = parseEbmlHeader(bytes);
    if (ebmlInfo.docType) {
      if (ebmlInfo.docType.toLowerCase() === 'matroska') {
        detectedFormat = 'MKV';
        mimeType = 'video/x-matroska';
      }
      metadataEntries.push({
        tag: 'DocType',
        label: 'EBML Document Type',
        value: ebmlInfo.docType,
        category: 'CONTAINER',
      });
    }
    if (ebmlInfo.muxingApp) {
      metadataEntries.push({
        tag: 'MuxingApp',
        label: 'Muxing Application / Library',
        value: ebmlInfo.muxingApp,
        category: 'CONTAINER',
      });
    }
    if (ebmlInfo.writingApp) {
      metadataEntries.push({
        tag: 'WritingApp',
        label: 'Writing Application',
        value: ebmlInfo.writingApp,
        category: 'CONTAINER',
      });
    }
    if (ebmlInfo.videoCodec) {
      videoCodecFourCC = ebmlInfo.videoCodec;
      metadataEntries.push({
        tag: 'VideoCodecID',
        label: 'Video Codec ID',
        value: ebmlInfo.videoCodec,
        category: 'CODEC',
      });
    }
    if (ebmlInfo.audioCodec) {
      hasAudio = true;
      audioCodecFourCC = ebmlInfo.audioCodec;
      metadataEntries.push({
        tag: 'AudioCodecID',
        label: 'Audio Codec ID',
        value: ebmlInfo.audioCodec,
        category: 'CODEC',
      });
    }
  }

  // Determine moov position relative to mdat
  let moovPosition: 'before_mdat (fast-start / web-optimized)' | 'after_mdat (standard)' | 'not_applicable' =
    'not_applicable';
  if (moovOffset !== -1 && mdatOffset !== -1) {
    if (moovOffset < mdatOffset) {
      moovPosition = 'before_mdat (fast-start / web-optimized)';
      metadataEntries.push({
        tag: 'MoovPlacement',
        label: 'Movie Header Box Position',
        value: 'Fast-Start (moov placed prior to mdat for instant progressive streaming)',
        category: 'CONTAINER',
      });
    } else {
      moovPosition = 'after_mdat (standard)';
      metadataEntries.push({
        tag: 'MoovPlacement',
        label: 'Movie Header Box Position',
        value: 'Standard (moov appended after mdat at end of file stream)',
        category: 'CONTAINER',
      });
    }
  }

  return {
    detectedFormat,
    mimeType,
    majorBrand,
    compatibleBrands,
    timescale,
    containerDurationSec,
    creationDate,
    modificationDate,
    videoCodecFourCC: videoCodecFourCC || (detectedFormat === 'WEBM' ? 'VP8/VP9' : 'H.264 (avc1)'),
    audioCodecFourCC: audioCodecFourCC || (hasAudio ? 'AAC (mp4a)' : undefined),
    hasAudio,
    audioChannels,
    audioSampleRate,
    trackWidth,
    trackHeight,
    rotation,
    moovPosition,
    shannonEntropy: entropy,
    atomsOrTracks,
    metadataEntries,
    anomalies,
    unavailableFeatures,
  };
}

/**
 * Parses sub-atoms inside `moov` (mvhd, trak, etc.)
 */
function parseMoovBox(
  bytes: Uint8Array,
  moovStart: number,
  moovSize: number,
  callbacks: {
    onMvhd: (timescale?: number, durationSec?: number, cDate?: string, mDate?: string) => void;
    onTrak: (w?: number, h?: number, rotation?: number, isAudio?: boolean, codec?: string) => void;
  }
) {
  let pos = moovStart + 8;
  const moovEnd = Math.min(bytes.length, moovStart + moovSize);

  while (pos + 8 <= moovEnd) {
    const boxSize =
      (bytes[pos] << 24) |
      (bytes[pos + 1] << 16) |
      (bytes[pos + 2] << 8) |
      bytes[pos + 3];
    const boxType = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (boxSize <= 0) break;

    if (boxType === 'mvhd') {
      const version = bytes[pos + 8];
      let timescale = 0;
      let duration = 0;
      let cTimeSec = 0;
      let mTimeSec = 0;

      if (version === 1) {
        // 64-bit creation, modification, timescale (4 bytes), duration (8 bytes)
        cTimeSec = readUint64(bytes, pos + 12);
        mTimeSec = readUint64(bytes, pos + 20);
        timescale =
          (bytes[pos + 28] << 24) |
          (bytes[pos + 29] << 16) |
          (bytes[pos + 30] << 8) |
          bytes[pos + 31];
        duration = readUint64(bytes, pos + 32);
      } else {
        // 32-bit version 0
        cTimeSec =
          (bytes[pos + 12] << 24) |
          (bytes[pos + 13] << 16) |
          (bytes[pos + 14] << 8) |
          bytes[pos + 15];
        mTimeSec =
          (bytes[pos + 16] << 24) |
          (bytes[pos + 17] << 16) |
          (bytes[pos + 18] << 8) |
          bytes[pos + 19];
        timescale =
          (bytes[pos + 20] << 24) |
          (bytes[pos + 21] << 16) |
          (bytes[pos + 22] << 8) |
          bytes[pos + 23];
        duration =
          (bytes[pos + 24] << 24) |
          (bytes[pos + 25] << 16) |
          (bytes[pos + 26] << 8) |
          bytes[pos + 27];
      }

      const durSec = timescale > 0 ? duration / timescale : undefined;
      const cDate = convertMacEpochToIso(cTimeSec);
      const mDate = convertMacEpochToIso(mTimeSec);

      callbacks.onMvhd(timescale, durSec, cDate, mDate);
    } else if (boxType === 'trak') {
      parseTrakBox(bytes, pos, boxSize, callbacks.onTrak);
    }

    pos += boxSize;
  }
}

/**
 * Parses sub-atoms inside `trak` (tkhd, mdia)
 */
function parseTrakBox(
  bytes: Uint8Array,
  trakStart: number,
  trakSize: number,
  onTrak: (w?: number, h?: number, rotation?: number, isAudio?: boolean, codec?: string) => void
) {
  let pos = trakStart + 8;
  const trakEnd = Math.min(bytes.length, trakStart + trakSize);
  let width: number | undefined;
  let height: number | undefined;
  let rotation = 0;
  let isAudio = false;
  let codecFourCC: string | undefined;

  while (pos + 8 <= trakEnd) {
    const boxSize =
      (bytes[pos] << 24) |
      (bytes[pos + 1] << 16) |
      (bytes[pos + 2] << 8) |
      bytes[pos + 3];
    const boxType = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (boxSize <= 0) break;

    if (boxType === 'tkhd') {
      const version = bytes[pos + 8];
      const matrixOffset = version === 1 ? pos + 56 : pos + 48;
      // Dimensions are at matrixOffset + 36 (fixed 16.16)
      const dimOffset = matrixOffset + 36;
      if (dimOffset + 8 <= bytes.length) {
        width = (bytes[dimOffset] << 8) | bytes[dimOffset + 1];
        height = (bytes[dimOffset + 4] << 8) | bytes[dimOffset + 5];
      }

      // Check transformation matrix for rotation
      if (matrixOffset + 36 <= bytes.length) {
        const b = (bytes[matrixOffset + 4] << 8) | bytes[matrixOffset + 5];
        const c = (bytes[matrixOffset + 12] << 8) | bytes[matrixOffset + 13];
        if (b === 1 && c === 65535) rotation = 90;
        else if (b === 65535 && c === 1) rotation = 270;
      }
    } else if (boxType === 'mdia') {
      // Find hdlr to see if video or sound
      const hdlrIdx = findSubBox(bytes, pos + 8, boxSize - 8, 'hdlr');
      if (hdlrIdx !== -1) {
        const subtype = String.fromCharCode(
          bytes[hdlrIdx + 16],
          bytes[hdlrIdx + 17],
          bytes[hdlrIdx + 18],
          bytes[hdlrIdx + 19]
        );
        if (subtype === 'soun') isAudio = true;
      }

      // Look for codec FourCC in stsd
      const minfIdx = findSubBox(bytes, pos + 8, boxSize - 8, 'minf');
      if (minfIdx !== -1) {
        const stblIdx = findSubBox(bytes, minfIdx + 8, 1024, 'stbl');
        if (stblIdx !== -1) {
          const stsdIdx = findSubBox(bytes, stblIdx + 8, 512, 'stsd');
          if (stsdIdx !== -1 && stsdIdx + 20 <= bytes.length) {
            // After stsd header (8 bytes) + version/flags (4 bytes) + entry count (4 bytes) comes entry size (4) and FourCC (4)
            codecFourCC = String.fromCharCode(
              bytes[stsdIdx + 20],
              bytes[stsdIdx + 21],
              bytes[stsdIdx + 22],
              bytes[stsdIdx + 23]
            );
          }
        }
      }
    }

    pos += boxSize;
  }

  onTrak(width, height, rotation, isAudio, codecFourCC);
}

function findSubBox(bytes: Uint8Array, start: number, maxLen: number, targetType: string): number {
  let pos = start;
  const end = Math.min(bytes.length, start + maxLen);
  while (pos + 8 <= end) {
    const size = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    if (type === targetType) return pos;
    if (size <= 0) break;
    pos += size;
  }
  return -1;
}

function readUint64(bytes: Uint8Array, offset: number): number {
  const hi = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  const lo = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
  return hi * 4294967296 + lo;
}

function convertMacEpochToIso(macSecs: number): string | undefined {
  if (!macSecs || macSecs < 1000000) return undefined;
  // Mac epoch starts 1904-01-01. Offset to Unix epoch (1970-01-01) is 2082844800 seconds.
  const unixSecs = macSecs - 2082844800;
  if (unixSecs <= 0 || unixSecs > 3000000000) return undefined;
  try {
    return new Date(unixSecs * 1000).toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Basic EBML parser for WebM/Matroska header and elements
 */
function parseEbmlHeader(bytes: Uint8Array): {
  docType?: string;
  muxingApp?: string;
  writingApp?: string;
  videoCodec?: string;
  audioCodec?: string;
} {
  let docType: string | undefined;
  let muxingApp: string | undefined;
  let writingApp: string | undefined;
  let videoCodec: string | undefined;
  let audioCodec: string | undefined;

  // Search string sequences in first 4KB
  const maxSearch = Math.min(bytes.length, 4096);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, maxSearch));

  if (text.includes('webm')) docType = 'webm';
  else if (text.includes('matroska')) docType = 'matroska';

  if (text.includes('V_VP8')) videoCodec = 'VP8 (V_VP8)';
  else if (text.includes('V_VP9')) videoCodec = 'VP9 (V_VP9)';
  else if (text.includes('V_AV1')) videoCodec = 'AV1 (V_AV1)';

  if (text.includes('A_OPUS')) audioCodec = 'Opus (A_OPUS)';
  else if (text.includes('A_VORBIS')) audioCodec = 'Vorbis (A_VORBIS)';

  const muxMatch = text.match(/(?:Lavf|Chrome|Firefox|GStreamer|FFmpeg)[^\x00-\x1f\x7f-\x9f]{2,30}/);
  if (muxMatch) {
    muxingApp = muxMatch[0].trim();
  }

  return { docType, muxingApp, writingApp, videoCodec, audioCodec };
}
