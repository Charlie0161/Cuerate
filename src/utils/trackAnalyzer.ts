// TrackAnalyzer.ts
// Client-side audio file metadata reader.
// Heavy analysis (BPM, key) is done server-side via FastAPI.
// This module handles what we can safely read in-app on mobile.

export interface TrackMetadata {
  filename: string;
  fileSize: number; // bytes
  mimeType: string;
  bitrate?: number;    // kbps
  isVBR?: boolean;
  sampleRate?: number; // Hz
  bitDepth?: number;   // 16, 24, 32
  duration?: number;   // seconds
  title?: string;
  artist?: string;
  album?: string;
  bpm?: number;        // from server analysis
  key?: string;        // Camelot notation from server
}

export interface TrackWarning {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  fix: string;
}

// Standalone Pioneer hardware constraints
const PIONEER_STANDALONE_RULES = {
  maxBitDepth: 24,        // 32-bit WAV will fail to load
  allowVBR: false,        // VBR MP3 causes seek errors
  maxSampleRate: 96000,   // 192kHz unsupported
  supportedFormats: ['mp3', 'aac', 'm4a', 'wav', 'aiff', 'flac'],
};

export function analyzeTrackForStandaloneGear(meta: TrackMetadata): TrackWarning[] {
  const warnings: TrackWarning[] = [];
  const ext = meta.filename.split('.').pop()?.toLowerCase() ?? '';

  // 32-bit WAV — critical fail on Pioneer XDJ/CDJ
  if (meta.bitDepth && meta.bitDepth === 32 && (ext === 'wav' || ext === 'aiff')) {
    warnings.push({
      severity: 'critical',
      message: `"${meta.filename}" is a ${meta.bitDepth}-bit file. Pioneer XDJ-RX3, XDJ-XZ, and most CDJs will refuse to load this file.`,
      fix: 'Convert to 16-bit or 24-bit WAV (44.1kHz, 48kHz). 16-bit 44.1kHz is universally safe.',
    });
  }

  // VBR MP3 — causes track length display errors and seek failures
  if (ext === 'mp3' && meta.isVBR) {
    warnings.push({
      severity: 'critical',
      message: `"${meta.filename}" is a VBR (Variable Bitrate) MP3. Pioneer standalone hardware shows incorrect track length and seek position with VBR files.`,
      fix: 'Re-encode as CBR (Constant Bitrate) 320kbps MP3 using VBR Fixer, MP3val, or re-rip from the original source.',
    });
  }

  // Low bitrate
  if (meta.bitrate && meta.bitrate < 192 && ext === 'mp3') {
    warnings.push({
      severity: 'warning',
      message: `"${meta.filename}" is encoded at ${meta.bitrate}kbps. Audible compression artifacts on a club sound system.`,
      fix: 'Minimum recommended: 320kbps MP3 or lossless WAV/AIFF for main sets.',
    });
  }

  // 192kHz sample rate — most hardware tops at 96kHz
  if (meta.sampleRate && meta.sampleRate > 96000) {
    warnings.push({
      severity: 'warning',
      message: `"${meta.filename}" has a ${meta.sampleRate / 1000}kHz sample rate. Most DJ hardware only supports up to 96kHz.`,
      fix: 'Downsample to 44.1kHz or 48kHz. There is no audible benefit above 48kHz for DJ use.',
    });
  }

  // Unsupported format
  if (!PIONEER_STANDALONE_RULES.supportedFormats.includes(ext)) {
    warnings.push({
      severity: 'critical',
      message: `"${meta.filename}" is a .${ext} file — not supported by Pioneer or Denon standalone hardware.`,
      fix: 'Convert to WAV (best quality), AIFF, or 320kbps MP3.',
    });
  }

  // Missing metadata
  if (!meta.title || !meta.artist) {
    warnings.push({
      severity: 'info',
      message: `"${meta.filename}" is missing title or artist tags.`,
      fix: 'Add ID3 tags using MusicBrainz Picard (free) so tracks display correctly on CDJ screens.',
    });
  }

  return warnings;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBitrateColor(bitrate?: number): 'green' | 'amber' | 'red' {
  if (!bitrate) return 'amber';
  if (bitrate >= 320) return 'green';
  if (bitrate >= 192) return 'amber';
  return 'red';
}
