import { AudioContainerInspection, AudioChunkInfo } from '../types/forensics';
import { formatHexPreview } from './binaryParser';

export function parseAudioContainer(buffer: ArrayBuffer): AudioContainerInspection {
  const bytes = new Uint8Array(buffer);
  const fileSize = bytes.length;
  const view = new DataView(buffer);
  const chunks: AudioChunkInfo[] = [];
  const structuralAnomalies: string[] = [];

  let format: AudioContainerInspection['format'] = 'UNKNOWN';
  let isRiffValid = false;
  let riffSizeDeclared: number | undefined;
  let dataChunkOffset: number | undefined;
  let dataChunkSize: number | undefined;
  let encodedBitDepth: number | undefined;
  let encodedChannels: number | undefined;
  let encodedSampleRate: number | undefined;
  let audioEncodingFormat: string | undefined;

  // 1. Check for RIFF / WAV
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45 // "WAVE"
  ) {
    format = 'WAV';
    isRiffValid = true;
    riffSizeDeclared = view.getUint32(4, true);

    chunks.push({
      id: 'RIFF',
      offset: 0,
      size: riffSizeDeclared + 8,
      description: `WAV Resource Interchange File Format (Declared payload: ${riffSizeDeclared} bytes)`,
    });

    if (riffSizeDeclared + 8 > fileSize) {
      structuralAnomalies.push(
        `Declared RIFF container size (${riffSizeDeclared + 8} bytes) exceeds actual physical file size (${fileSize} bytes). File may be truncated.`
      );
    }

    // Walk RIFF chunks within declared RIFF boundary
    const maxRiffOffset = riffSizeDeclared !== undefined ? Math.min(fileSize, riffSizeDeclared + 8) : fileSize;
    let offset = 12;
    while (offset + 8 <= maxRiffOffset) {
      const c0 = bytes[offset];
      const c1 = bytes[offset + 1];
      const c2 = bytes[offset + 2];
      const c3 = bytes[offset + 3];

      // Check if 4CC chunk ID is valid ASCII [32..126]
      const isValid4CC =
        c0 >= 32 && c0 <= 126 &&
        c1 >= 32 && c1 <= 126 &&
        c2 >= 32 && c2 <= 126 &&
        c3 >= 32 && c3 <= 126;

      if (!isValid4CC) {
        // Not a valid FourCC chunk; stop walking chunks here
        break;
      }

      const chunkId = String.fromCharCode(c0, c1, c2, c3);
      const chunkSize = view.getUint32(offset + 4, true);

      let chunkDesc = `Chunk: ${chunkId} (${chunkSize} bytes)`;

      if (chunkId === 'fmt ') {
        if (offset + 8 + Math.min(chunkSize, 16) <= fileSize) {
          const audioFormat = view.getUint16(offset + 8, true);
          encodedChannels = view.getUint16(offset + 10, true);
          encodedSampleRate = view.getUint32(offset + 12, true);
          encodedBitDepth = chunkSize >= 16 ? view.getUint16(offset + 22, true) : undefined;

          if (audioFormat === 1) {
            audioEncodingFormat = 'PCM (Uncompressed)';
          } else if (audioFormat === 3) {
            audioEncodingFormat = 'IEEE 754 Float';
          } else if (audioFormat === 6) {
            audioEncodingFormat = 'A-law';
          } else if (audioFormat === 7) {
            audioEncodingFormat = 'µ-law';
          } else if (audioFormat === 65534) {
            audioEncodingFormat = 'WAVE_FORMAT_EXTENSIBLE';
          } else {
            audioEncodingFormat = `Codec ID: 0x${audioFormat.toString(16).padStart(4, '0')}`;
          }

          chunkDesc = `Audio Format descriptor: ${audioEncodingFormat}, ${encodedChannels} ch, ${encodedSampleRate} Hz, ${encodedBitDepth || 'unknown'} bits`;
        }
      } else if (chunkId === 'data') {
        dataChunkOffset = offset;
        dataChunkSize = chunkSize;
        chunkDesc = `Audio Waveform Raw Sample Payload (${chunkSize} bytes)`;
      } else if (chunkId === 'LIST') {
        chunkDesc = `Metadata List chunk (INFO / tags)`;
      } else if (chunkId === 'id3 ' || chunkId === 'ID3 ') {
        chunkDesc = `Embedded ID3v2 tag chunk`;
      } else if (chunkId === 'bext') {
        chunkDesc = `Broadcast Wave Format (BWF) extension chunk`;
      }

      chunks.push({
        id: chunkId,
        offset,
        size: chunkSize,
        description: chunkDesc,
      });

      // RIFF chunks are word-aligned (padded to multiple of 2)
      const paddedSize = chunkSize + (chunkSize % 2);
      offset += 8 + paddedSize;

      // Avoid infinite loop if chunkSize is 0 or corrupt
      if (chunkSize === 0) {
        break;
      }
    }
  } else if (
    // 2. Check for MP3 ID3v2 or Frame Sync
    bytes.length >= 3 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33 // "ID3"
  ) {
    format = 'MP3';
    audioEncodingFormat = 'MPEG Audio Layer 3 (with ID3v2 header)';
    if (bytes.length >= 10) {
      const id3Major = bytes[3];
      const id3Minor = bytes[4];
      // Syncsafe integer for ID3 tag size
      const tagSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);

      chunks.push({
        id: 'ID3v2',
        offset: 0,
        size: tagSize + 10,
        description: `ID3v2.${id3Major}.${id3Minor} metadata container (${tagSize + 10} bytes total)`,
      });
    }
  } else if (
    // MP3 sync word (11 bits set: 0xFF 0xFB, 0xFA, 0xF3, etc.)
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    (bytes[1] & 0xe0) === 0xe0
  ) {
    format = 'MP3';
    audioEncodingFormat = 'MPEG Audio Layer 3 (Raw Stream)';
    chunks.push({
      id: 'MPEG_FRAME',
      offset: 0,
      size: fileSize,
      description: 'MPEG Audio Stream (Sync word 0xFFE0 detected at offset 0)',
    });
  } else if (
    // 3. FLAC magic number "fLaC"
    bytes.length >= 4 &&
    bytes[0] === 0x66 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x61 &&
    bytes[3] === 0x43
  ) {
    format = 'FLAC';
    audioEncodingFormat = 'Free Lossless Audio Codec (FLAC)';
    chunks.push({
      id: 'fLaC',
      offset: 0,
      size: fileSize,
      description: 'FLAC stream marker (Lossless audio container)',
    });
  } else if (
    // 4. OGG magic number "OggS"
    bytes.length >= 4 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    format = 'OGG';
    audioEncodingFormat = 'Ogg Vorbis / Opus Stream';
    chunks.push({
      id: 'OggS',
      offset: 0,
      size: fileSize,
      description: 'Ogg bitstream encapsulation container',
    });
  } else if (
    // 5. M4A / MP4 ISO base media format with M4A brand
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    format = 'M4A';
    audioEncodingFormat = 'MPEG-4 Audio / AAC (ISO BMFF)';
    chunks.push({
      id: 'ftyp',
      offset: 0,
      size: view.getUint32(0),
      description: 'MPEG-4 Audio Container (ftyp)',
    });
  } else if (
    // 6. WebM EBML
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    format = 'WEBM';
    audioEncodingFormat = 'WebM Audio Stream (Opus / Vorbis in EBML)';
    chunks.push({
      id: 'EBML',
      offset: 0,
      size: fileSize,
      description: 'Extensible Binary Meta Language audio container',
    });
  }

  // Detect Trailing Data in WAV files (Critical Steganography / Tampering Indicator)
  let trailingBytesCount = 0;
  let trailingDataHexPreview: string | undefined;
  let hasTrailingData = false;

  if (format === 'WAV' && dataChunkOffset !== undefined && dataChunkSize !== undefined) {
    // If the data chunk is the last standard audio chunk, check for excess bytes past the end of declared chunks
    const lastChunk = chunks[chunks.length - 1];
    const declaredEnd = Math.max(
      dataChunkOffset + 8 + dataChunkSize + (dataChunkSize % 2),
      (lastChunk ? lastChunk.offset + lastChunk.size + (lastChunk.size % 2) : 0),
      (riffSizeDeclared !== undefined ? riffSizeDeclared + 8 : 0)
    );

    if (fileSize > declaredEnd + 4) {
      trailingBytesCount = fileSize - declaredEnd;
      hasTrailingData = true;
      const trailingSlice = bytes.slice(declaredEnd, declaredEnd + Math.min(trailingBytesCount, 64));
      trailingDataHexPreview = formatHexPreview(trailingSlice.buffer);
      structuralAnomalies.push(
        `Detected ${trailingBytesCount} trailing bytes appended beyond valid RIFF audio chunk boundaries. Potential covert steganographic or payload injection indicator.`
      );
    }
  }

  return {
    format,
    isRiffValid,
    riffSizeDeclared,
    actualFileSize: fileSize,
    dataChunkOffset,
    dataChunkSize,
    trailingBytesCount,
    trailingDataHexPreview,
    hasTrailingData,
    encodedBitDepth,
    encodedChannels,
    encodedSampleRate,
    audioEncodingFormat,
    chunks,
    structuralAnomalies,
  };
}
