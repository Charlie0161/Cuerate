import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const MIN_TAPS = 4;
const RESET_TIMEOUT = 3000;

export default function BpmTapperScreen() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const [tapping, setTapping] = useState(false);
  const timestamps = useRef<number[]>([]);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    timestamps.current = [];
    setBpm(null);
    setTaps(0);
    setTapping(false);
  }, []);

  function tap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = Date.now();
    timestamps.current.push(now);

    // Clear auto-reset timer and restart it
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(reset, RESET_TIMEOUT);

    setTapping(true);
    const n = timestamps.current.length;
    setTaps(n);

    if (n >= MIN_TAPS) {
      const intervals: number[] = [];
      for (let i = 1; i < n; i++) {
        intervals.push(timestamps.current[i] - timestamps.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avgInterval));
    }
  }

  const bpmColor =
    bpm === null ? C.textMuted
    : bpm < 90 ? C.success
    : bpm < 130 ? C.accent
    : bpm < 160 ? C.warning
    : '#FF4D4D';

  const bpmLabel =
    bpm === null ? '' :
    bpm < 75 ? 'Downtempo' :
    bpm < 100 ? 'Hip-Hop / R&B' :
    bpm < 120 ? 'House' :
    bpm < 135 ? 'Techno' :
    bpm < 150 ? 'Trance' :
    bpm < 175 ? 'Drum & Bass' :
    'Hardcore';

  return (
    <View style={s.container}>
      <Text style={s.title}>BPM Tapper</Text>
      <Text style={s.sub}>Tap the button in time to the beat</Text>

      {/* BPM display */}
      <View style={s.bpmBox}>
        <Text style={[s.bpmNum, { color: bpmColor }]}>
          {bpm !== null ? bpm : '—'}
        </Text>
        <Text style={s.bpmUnit}>BPM</Text>
        {bpmLabel ? <Text style={[s.bpmLabel, { color: bpmColor }]}>{bpmLabel}</Text> : null}
        {taps > 0 && taps < MIN_TAPS && (
          <Text style={s.tapHint}>{MIN_TAPS - taps} more tap{MIN_TAPS - taps !== 1 ? 's' : ''}…</Text>
        )}
      </View>

      {/* Tap button */}
      <TouchableOpacity
        style={[s.tapBtn, tapping && s.tapBtnActive]}
        onPress={tap}
        activeOpacity={0.75}
      >
        <Text style={s.tapBtnText}>TAP</Text>
      </TouchableOpacity>

      {/* Reset */}
      {taps > 0 && (
        <TouchableOpacity style={s.resetBtn} onPress={reset}>
          <Text style={s.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      )}

      {/* Camelot hint */}
      {bpm !== null && (
        <View style={s.hintBox}>
          <Text style={s.hintTitle}>Half / Double time</Text>
          <View style={s.hintRow}>
            <View style={s.hintPill}>
              <Text style={s.hintPillLabel}>½</Text>
              <Text style={s.hintPillVal}>{Math.round(bpm / 2)} BPM</Text>
            </View>
            <View style={s.hintPill}>
              <Text style={s.hintPillLabel}>×2</Text>
              <Text style={s.hintPillVal}>{bpm * 2} BPM</Text>
            </View>
            <View style={s.hintPill}>
              <Text style={s.hintPillLabel}>+6%</Text>
              <Text style={s.hintPillVal}>{Math.round(bpm * 1.06)} BPM</Text>
            </View>
            <View style={s.hintPill}>
              <Text style={s.hintPillLabel}>−6%</Text>
              <Text style={s.hintPillVal}>{Math.round(bpm * 0.94)} BPM</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 6 },
  sub: { fontSize: 14, color: C.textMuted, marginBottom: 40 },
  bpmBox: { alignItems: 'center', marginBottom: 40 },
  bpmNum: { fontSize: 96, fontWeight: '800', lineHeight: 100 },
  bpmUnit: { fontSize: 18, fontWeight: '600', color: C.textMuted, marginTop: 4 },
  bpmLabel: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  tapHint: { fontSize: 13, color: C.textMuted, marginTop: 10 },
  tapBtn: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: C.accentDim,
    borderWidth: 3, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  tapBtnActive: { backgroundColor: C.accent },
  tapBtnText: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 4 },
  resetBtn: { paddingHorizontal: 24, paddingVertical: 10 },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  hintBox: {
    width: '100%', backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 18, marginTop: 16,
  },
  hintTitle: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  hintRow: { flexDirection: 'row', gap: 8 },
  hintPill: {
    flex: 1, backgroundColor: C.raised, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', padding: 10, gap: 4,
  },
  hintPillLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  hintPillVal: { fontSize: 14, color: C.text, fontWeight: '700' },
});
