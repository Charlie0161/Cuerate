// ─────────────────────────────────────────────────────────────────────────────
// PATCH: Replace the AddTrackModal in SetBuilderScreen.tsx with this version.
// It adds a "Search" tab that queries track_submissions from Supabase.
// Everything else in SetBuilderScreen.tsx stays the same.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { CrateTrack, CamelotKey } from '../store/setBuilderStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  warning: '#F5A623', warningBg: '#1F1508',
  success: '#4DCC8F', successBg: '#071A0F',
  info: '#4DB8FF', infoBg: '#0A1929',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const KEY_NAMES: Record<string, string> = {
  '1A':'A♭m','2A':'E♭m','3A':'B♭m','4A':'Fm','5A':'Cm','6A':'Gm',
  '7A':'Dm','8A':'Am','9A':'Em','10A':'Bm','11A':'F#m','12A':'C#m',
  '1B':'B','2B':'F#','3B':'D♭','4B':'A♭','5B':'E♭','6B':'B♭',
  '7B':'F','8B':'C','9B':'G','10B':'D','11B':'A','12B':'E',
};

const KEY_HUE: Record<string, string> = {
  '1':'#7C5CFC','2':'#9B59FC','3':'#B05AF5','4':'#C86EF0','5':'#D97BE8','6':'#E88CE0',
  '7':'#F49CD6','8':'#E8A0C8','9':'#D4A8D0','10':'#C0B0D8','11':'#AAB8E0','12':'#94C0E8',
};
const KEY_HUE_B: Record<string, string> = {
  '1':'#5C9CFC','2':'#5CB8FC','3':'#4CCCE0','4':'#3DDCC0','5':'#40DCA0','6':'#52E080',
  '7':'#6AE060','8':'#8EE040','9':'#B8E040','10':'#DCE040','11':'#ECC840','12':'#F0A040',
};

export function keyColor(k: string): string {
  const num = k.replace(/[AB]/, '');
  return k.endsWith('A') ? KEY_HUE[num] ?? C.accent : KEY_HUE_B[num] ?? C.info;
}

const CAMELOT_KEYS: CamelotKey[] = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

// ─── Track search result type ─────────────────────────────────────────────────

interface SubmittedTrack {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  camelot_key: string | null;
  musical_key: string | null;
  energy: number | null;
  platform: string;
  external_url: string;
  thumbnail_url: string | null;
  status: 'pending' | 'analysing' | 'ready' | 'failed';
}

// ─── KeyBadge (self-contained for this file) ──────────────────────────────────

function KeyBadge({ camelotKey }: { camelotKey: string }) {
  const col = keyColor(camelotKey);
  return (
    <View style={[as.keyBadge, { backgroundColor: col + '22', borderColor: col + '55' }]}>
      <Text style={[as.keyBadgeText, { color: col }]}>{camelotKey}</Text>
    </View>
  );
}

// ─── Platform icon ────────────────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
  const icon = platform === 'soundcloud' ? 'logo-soundcloud'
    : platform === 'youtube' ? 'logo-youtube'
    : 'musical-notes-outline';
  const col = platform === 'soundcloud' ? '#FF5500'
    : platform === 'youtube' ? '#FF0000'
    : C.accent;
  return <Ionicons name={icon as any} size={14} color={col} />;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: SubmittedTrack['status'] }) {
  const map = {
    pending:   { label: 'Queued',     col: C.warning },
    analysing: { label: 'Analysing',  col: C.info },
    ready:     { label: 'Ready',      col: C.success },
    failed:    { label: 'Failed',     col: C.critical },
  };
  const { label, col } = map[status] ?? { label: status, col: C.textMuted };
  return (
    <View style={[as.statusPill, { backgroundColor: col + '18', borderColor: col + '44' }]}>
      <View style={[as.statusDot, { backgroundColor: col }]} />
      <Text style={[as.statusText, { color: col }]}>{label}</Text>
    </View>
  );
}

// ─── AddTrackModal (full replacement) ────────────────────────────────────────

type ModalTab = 'search' | 'manual';

interface AddTrackModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (track: Omit<CrateTrack, 'id' | 'createdAt'>) => void;
}

export function AddTrackModal({ visible, onClose, onAdd }: AddTrackModalProps) {
  const [tab, setTab]             = useState<ModalTab>('search');
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<SubmittedTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds]   = useState<Set<string>>(new Set());
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual form state
  const [title, setTitle]           = useState('');
  const [artist, setArtist]         = useState('');
  const [bpm, setBpm]               = useState('');
  const [key, setKey]               = useState<CamelotKey | ''>('');
  const [energy, setEnergy]         = useState('5');
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);

  const resetManual = () => {
    setTitle(''); setArtist(''); setBpm(''); setKey(''); setEnergy('5');
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      // Full-text search on title + artist
      const { data, error } = await supabase
        .from('track_submissions')
        .select('id, title, artist, bpm, camelot_key, musical_key, energy, platform, external_url, thumbnail_url, status')
        .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
        .in('status', ['ready', 'pending', 'analysing'])
        .order('status')           // ready first
        .limit(20);
      if (!error && data) setResults(data as SubmittedTrack[]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // ── Add from search ────────────────────────────────────────────────────────
  const addFromSearch = (track: SubmittedTrack) => {
    if (track.status !== 'ready' || !track.bpm || !track.camelot_key) return;
    onAdd({
      title: track.title,
      artist: track.artist ?? '',
      bpm: track.bpm,
      camelotKey: track.camelot_key as CamelotKey,
      energy: track.energy ? Math.round(track.energy * 10) : 5,
      source: 'manual', // will be 'shazam' once Feature 2 ships
    });
    setAddedIds(prev => new Set([...prev, track.id]));
  };

  // ── Add manual ─────────────────────────────────────────────────────────────
  const addManual = () => {
    if (!title.trim()) { alert('Title is required.'); return; }
    const bpmInt = parseInt(bpm);
    if (!bpmInt || bpmInt < 60 || bpmInt > 220) { alert('BPM must be 60–220.'); return; }
    if (!key) { alert('Please select a Camelot key.'); return; }
    onAdd({
      title: title.trim(), artist: artist.trim(),
      bpm: bpmInt, camelotKey: key,
      energy: Math.min(10, Math.max(1, parseInt(energy) || 5)),
      source: 'manual',
    });
    resetManual();
    onClose();
  };

  const handleClose = () => { resetManual(); setQuery(''); setResults([]); setAddedIds(new Set()); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={as.header}>
          <Text style={as.headerTitle}>Add track</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={as.tabRow}>
          <TouchableOpacity style={[as.tabBtn, tab === 'search' && as.tabBtnActive]} onPress={() => setTab('search')}>
            <Ionicons name="search-outline" size={15} color={tab === 'search' ? C.accent : C.textSec} />
            <Text style={[as.tabText, tab === 'search' && as.tabTextActive]}>Search tracks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[as.tabBtn, tab === 'manual' && as.tabBtnActive]} onPress={() => setTab('manual')}>
            <Ionicons name="create-outline" size={15} color={tab === 'manual' ? C.accent : C.textSec} />
            <Text style={[as.tabText, tab === 'manual' && as.tabTextActive]}>Manual entry</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search tab ── */}
        {tab === 'search' && (
          <>
            <View style={as.searchBar}>
              <Ionicons name="search" size={16} color={C.textMuted} />
              <TextInput
                style={as.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by title or artist…"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={C.accent} />}
              {query.length > 0 && !searching && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={16} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {results.length === 0 && query.length > 0 && !searching && (
                <View style={as.emptySearch}>
                  <Ionicons name="search-outline" size={32} color={C.textMuted} />
                  <Text style={as.emptyTitle}>No tracks found</Text>
                  <Text style={as.emptyBody}>
                    Submit the track on <Text style={{ color: C.accent }}>cuerate.co.uk</Text> and it'll be analysed and ready in ~60 seconds.
                  </Text>
                  <TouchableOpacity
                    style={as.webLink}
                    onPress={() => Linking.openURL('https://cuerate.co.uk')}
                  >
                    <Ionicons name="open-outline" size={14} color={C.accent} />
                    <Text style={as.webLinkText}>Open cuerate.co.uk</Text>
                  </TouchableOpacity>
                </View>
              )}

              {results.length === 0 && query.length === 0 && (
                <View style={as.emptySearch}>
                  <Ionicons name="musical-notes-outline" size={32} color={C.textMuted} />
                  <Text style={as.emptyTitle}>Search the track database</Text>
                  <Text style={as.emptyBody}>
                    Tracks submitted on cuerate.co.uk are automatically analysed for BPM and key. Search to find and add them to your crate.
                  </Text>
                </View>
              )}

              {results.map(track => {
                const added = addedIds.has(track.id);
                const canAdd = track.status === 'ready' && !!track.bpm && !!track.camelot_key;
                return (
                  <View key={track.id} style={as.resultRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <PlatformIcon platform={track.platform} />
                        <Text style={as.resultTitle} numberOfLines={1}>{track.title}</Text>
                      </View>
                      {track.artist && <Text style={as.resultArtist}>{track.artist}</Text>}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {track.camelot_key && <KeyBadge camelotKey={track.camelot_key} />}
                        {track.bpm && <Text style={as.resultBpm}>{track.bpm} BPM</Text>}
                        <StatusPill status={track.status} />
                      </View>
                    </View>
                    {canAdd ? (
                      <TouchableOpacity
                        style={[as.addBtn, added && as.addBtnDone]}
                        onPress={() => !added && addFromSearch(track)}
                      >
                        <Ionicons
                          name={added ? 'checkmark' : 'add'}
                          size={16}
                          color={added ? C.success : C.accent}
                        />
                        <Text style={[as.addBtnText, added && { color: C.success }]}>
                          {added ? 'Added' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={as.waitingBtn}>
                        <Text style={as.waitingText}>
                          {track.status === 'failed' ? 'Failed' : 'Analysing…'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        )}

        {/* ── Manual tab ── */}
        {tab === 'manual' && (
          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={as.fieldLabel}>Title *</Text>
            <TextInput style={as.fieldInput} value={title} onChangeText={setTitle}
              placeholder="Track title" placeholderTextColor={C.textMuted} />

            <Text style={as.fieldLabel}>Artist</Text>
            <TextInput style={as.fieldInput} value={artist} onChangeText={setArtist}
              placeholder="Artist name" placeholderTextColor={C.textMuted} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={as.fieldLabel}>BPM *</Text>
                <TextInput style={as.fieldInput} value={bpm} onChangeText={setBpm}
                  keyboardType="number-pad" placeholder="128" placeholderTextColor={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={as.fieldLabel}>Energy (1–10)</Text>
                <TextInput style={as.fieldInput} value={energy} onChangeText={setEnergy}
                  keyboardType="number-pad" placeholder="5" placeholderTextColor={C.textMuted} />
              </View>
            </View>

            <Text style={as.fieldLabel}>Camelot key *</Text>
            <TouchableOpacity style={as.keyPickerBtn} onPress={() => setKeyPickerOpen(!keyPickerOpen)}>
              {key ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <KeyBadge camelotKey={key} />
                  <Text style={{ color: C.text, fontSize: 14 }}>{KEY_NAMES[key]}</Text>
                </View>
              ) : (
                <Text style={{ color: C.textMuted, fontSize: 14 }}>Select key…</Text>
              )}
              <Ionicons name={keyPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.textSec} />
            </TouchableOpacity>

            {keyPickerOpen && (
              <View style={as.keyGrid}>
                {(['A', 'B'] as const).map(letter => (
                  <View key={letter} style={{ marginBottom: 10 }}>
                    <Text style={as.keyGroupLabel}>{letter === 'A' ? 'Minor (A)' : 'Major (B)'}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const k = `${i + 1}${letter}` as CamelotKey;
                        const col = keyColor(k);
                        const selected = key === k;
                        return (
                          <TouchableOpacity key={k}
                            style={[as.keyOption, { backgroundColor: col + '22', borderColor: selected ? col : col + '44' }, selected && { borderWidth: 2 }]}
                            onPress={() => { setKey(k); setKeyPickerOpen(false); }}
                          >
                            <Text style={[as.keyOptionText, { color: col }]}>{k}</Text>
                            <Text style={[as.keyOptionSub, { color: col + 'AA' }]}>{KEY_NAMES[k]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              <TouchableOpacity style={[as.cancelBtn, { flex: 1 }]} onPress={() => { resetManual(); onClose(); }}>
                <Text style={as.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[as.confirmBtn, { flex: 1 }]} onPress={addManual}>
                <Ionicons name="add-circle" size={16} color={C.accent} style={{ marginRight: 6 }} />
                <Text style={as.confirmBtnText}>Add to crate</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const as = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, padding: 4, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8 },
  tabBtnActive: { backgroundColor: C.raised },
  tabText: { fontSize: 13, color: C.textSec, fontWeight: '500' },
  tabTextActive: { color: C.accent },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  resultTitle: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  resultArtist: { fontSize: 12, color: C.textMuted },
  resultBpm: { fontSize: 12, color: C.textSec },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  addBtnDone: { borderColor: C.success + '60', backgroundColor: C.successBg },
  addBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  waitingBtn: { paddingHorizontal: 10, paddingVertical: 7 },
  waitingText: { fontSize: 12, color: C.textMuted },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  keyBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  keyBadgeText: { fontSize: 11, fontWeight: '700' },
  emptySearch: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptyBody: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  webLinkText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  fieldLabel: { fontSize: 12, color: C.textMuted, marginBottom: 6, marginTop: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 44, fontSize: 14, color: C.text },
  keyPickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 44 },
  keyGrid: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 8 },
  keyGroupLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  keyOption: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', minWidth: 48 },
  keyOptionText: { fontSize: 12, fontWeight: '700' },
  keyOptionSub: { fontSize: 9, marginTop: 1 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 8, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent },
  confirmBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
});
