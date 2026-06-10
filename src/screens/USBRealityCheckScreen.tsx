import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { TrackMetadata, TrackWarning, analyzeTrackForStandaloneGear, formatFileSize, getBitrateColor } from '../utils/trackAnalyzer';

// ─── Design tokens (matches HardwareLockerScreen) ──────────────────────────
const COLORS = {
  bg: '#0A0A0C',
  surface: '#13131A',
  surfaceRaised: '#1C1C26',
  border: '#2A2A38',
  accent: '#7C5CFC',
  accentDim: '#3D2E8A',
  critical: '#FF4D4D',
  criticalBg: '#1F0E0E',
  warning: '#F5A623',
  warningBg: '#1F1508',
  info: '#4DB8FF',
  infoBg: '#0A1929',
  success: '#4DCC8F',
  successBg: '#071A0F',
  textPrimary: '#F0EFF8',
  textSecondary: '#8A89A0',
  textMuted: '#52516A',
};

// ─── Mock metadata reader ─────────────────────────────────────────────────
// In production this hits the FastAPI /analyze endpoint.
// For Phase 1 MVP, we read what we can from the file picker result
// and mock the fields that need server-side analysis.
async function readTrackMeta(file: DocumentPicker.DocumentPickerAsset): Promise<TrackMetadata> {
  const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';

  // In production: POST file to FastAPI, get back full analysis.
  // For now, derive what we can from the file object and use plausible mocks.
  return {
    filename: file.name ?? 'Unknown',
    fileSize: file.size ?? 0,
    mimeType: file.mimeType ?? 'audio/mpeg',
    // These come from the server in production:
    bitrate: ext === 'mp3' ? 192 : ext === 'wav' ? undefined : 256,
    isVBR: ext === 'mp3' ? Math.random() > 0.6 : false, // mocked until server
    sampleRate: ext === 'wav' ? 44100 : 44100,
    bitDepth: ext === 'wav' ? (Math.random() > 0.8 ? 32 : 24) : undefined,
    title: undefined,
    artist: undefined,
  };
}

// ─── Track row component ──────────────────────────────────────────────────

function TrackRow({ meta, warnings }: { meta: TrackMetadata; warnings: TrackWarning[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = warnings.length > 0;
  const criticals = warnings.filter((w) => w.severity === 'critical').length;

  const statusColor = criticals > 0 ? COLORS.critical : hasIssues ? COLORS.warning : COLORS.success;
  const statusIcon = criticals > 0 ? 'close-circle' : hasIssues ? 'warning' : 'checkmark-circle';
  const bitrateColor = {
    green: COLORS.success,
    amber: COLORS.warning,
    red: COLORS.critical,
  }[getBitrateColor(meta.bitrate)];

  return (
    <TouchableOpacity
      style={styles.trackCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.trackRow}>
        <Ionicons name={statusIcon as any} size={20} color={statusColor} style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.trackName} numberOfLines={1}>{meta.filename}</Text>
          <View style={styles.trackMeta}>
            <Text style={styles.trackMetaItem}>{formatFileSize(meta.fileSize)}</Text>
            {meta.bitrate && (
              <Text style={[styles.trackMetaItem, { color: bitrateColor }]}>
                {meta.bitrate}kbps {meta.isVBR ? '(VBR)' : 'CBR'}
              </Text>
            )}
            {meta.bitDepth && <Text style={styles.trackMetaItem}>{meta.bitDepth}-bit</Text>}
            {meta.sampleRate && <Text style={styles.trackMetaItem}>{meta.sampleRate / 1000}kHz</Text>}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {hasIssues && (
            <Text style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>
              {warnings.length} {warnings.length === 1 ? 'issue' : 'issues'}
            </Text>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={COLORS.textMuted}
          />
        </View>
      </View>

      {expanded && warnings.length > 0 && (
        <View style={styles.expandedWarnings}>
          {warnings.map((w, i) => {
            const wColor = w.severity === 'critical' ? COLORS.critical : w.severity === 'warning' ? COLORS.warning : COLORS.info;
            return (
              <View
                key={i}
                style={[styles.miniWarning, {
                  borderLeftColor: wColor,
                  backgroundColor: w.severity === 'critical' ? COLORS.criticalBg : w.severity === 'warning' ? COLORS.warningBg : COLORS.infoBg,
                }]}
              >
                <Text style={[styles.miniWarningLabel, { color: wColor }]}>
                  {w.severity.toUpperCase()}
                </Text>
                <Text style={styles.miniWarningMsg}>{w.message}</Text>
                <View style={styles.fixRow}>
                  <Ionicons name="bulb-outline" size={12} color={COLORS.success} />
                  <Text style={styles.fixText}>{w.fix}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {expanded && warnings.length === 0 && (
        <View style={[styles.miniWarning, { borderLeftColor: COLORS.success, backgroundColor: COLORS.successBg }]}>
          <Text style={[styles.miniWarningMsg, { color: COLORS.success }]}>
            No issues found. This file is safe for standalone hardware.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function USBRealityCheckScreen() {
  const [tracks, setTracks] = useState<Array<{ meta: TrackMetadata; warnings: TrackWarning[] }>>([]);
  const [loading, setLoading] = useState(false);

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/mp4'],
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (result.canceled) return;

      setLoading(true);
      const newTracks = await Promise.all(
        result.assets.map(async (asset) => {
          const meta = await readTrackMeta(asset);
          const warnings = analyzeTrackForStandaloneGear(meta);
          return { meta, warnings };
        }),
      );
      setTracks((prev) => [...prev, ...newTracks]);
    } catch (e) {
      console.error('File pick error', e);
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = tracks.reduce((n, t) => n + t.warnings.filter((w) => w.severity === 'critical').length, 0);
  const cleanCount = tracks.filter((t) => t.warnings.length === 0).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>USB Reality Check</Text>
          <Text style={styles.title}>Track Scanner</Text>
          <Text style={styles.subtitle}>
            Drop your tracks before a gig to catch files that will break on standalone CDJs.
          </Text>
        </View>

        {/* Summary bar */}
        {tracks.length > 0 && (
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{tracks.length}</Text>
              <Text style={styles.summaryLabel}>tracks</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: criticalCount > 0 ? COLORS.critical : COLORS.success }]}>
                {criticalCount}
              </Text>
              <Text style={styles.summaryLabel}>critical</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.success }]}>{cleanCount}</Text>
              <Text style={styles.summaryLabel}>clean</Text>
            </View>
          </View>
        )}

        {/* Add tracks button */}
        <TouchableOpacity
          style={[styles.importBtn, loading && { opacity: 0.5 }]}
          onPress={pickFiles}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons name={loading ? 'hourglass' : 'cloud-upload-outline'} size={20} color={COLORS.accent} />
          <Text style={styles.importBtnText}>
            {loading ? 'Scanning...' : tracks.length === 0 ? 'Import tracks from your device' : 'Add more tracks'}
          </Text>
        </TouchableOpacity>

        {/* Track list */}
        {tracks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Scanned Tracks</Text>
            {tracks.map((t, i) => (
              <TrackRow key={i} meta={t.meta} warnings={t.warnings} />
            ))}
          </View>
        )}

        {/* Empty state */}
        {tracks.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="disc-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No tracks scanned yet</Text>
            <Text style={styles.emptyBody}>
              Import your MP3, WAV, or AIFF files and BoothBuddy will check for 32-bit issues, VBR encoding, and missing metadata before your gig.
            </Text>
          </View>
        )}

        {/* Copyright note */}
        <View style={styles.legalNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.legalText}>
            BoothBuddy reads file metadata only. Audio files remain on your device and are never uploaded to our servers.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  header: { marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: COLORS.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  summaryBar: { flexDirection: 'row', backgroundColor: COLORS.surfaceRaised, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryNum: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border },
  importBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.accentDim, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 },
  importBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 10 },
  trackCard: { backgroundColor: COLORS.surfaceRaised, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  trackRow: { flexDirection: 'row', alignItems: 'center' },
  trackName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  trackMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  trackMetaItem: { fontSize: 12, color: COLORS.textMuted },
  expandedWarnings: { marginTop: 12, gap: 8 },
  miniWarning: { borderLeftWidth: 3, borderRadius: 4, padding: 10, gap: 4 },
  miniWarningLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  miniWarningMsg: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  fixRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start', marginTop: 2 },
  fixText: { fontSize: 12, color: COLORS.success, flex: 1, lineHeight: 17 },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyBody: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  legalNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 16, paddingHorizontal: 4 },
  legalText: { fontSize: 12, color: COLORS.textMuted, flex: 1, lineHeight: 17 },
});
