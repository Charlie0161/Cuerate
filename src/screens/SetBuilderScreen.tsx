import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, Modal, Alert, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useSetBuilderStore,
  CrateTrack,
  CamelotKey,
  SetLength,
  keyCompat,
  bpmCompat,
  calcHarmonicScore,
} from '../store/setBuilderStore';
import { useAuthStore } from '../store/authStore';

// ─── Design tokens (matches GigCalculatorScreen exactly) ─────────────────────

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  warning: '#F5A623', warningBg: '#1F1508',
  success: '#4DCC8F', successBg: '#071A0F',
  info: '#4DB8FF', infoBg: '#0A1929',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

// ─── Camelot data ─────────────────────────────────────────────────────────────

const CAMELOT_KEYS: CamelotKey[] = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

const KEY_NAMES: Record<CamelotKey, string> = {
  '1A':'A♭m','2A':'E♭m','3A':'B♭m','4A':'Fm','5A':'Cm','6A':'Gm',
  '7A':'Dm','8A':'Am','9A':'Em','10A':'Bm','11A':'F#m','12A':'C#m',
  '1B':'B','2B':'F#','3B':'D♭','4B':'A♭','5B':'E♭','6B':'B♭',
  '7B':'F','8B':'C','9B':'G','10B':'D','11B':'A','12B':'E',
};

// Colour per Camelot number — purple gradient for A (minor), teal for B (major)
const KEY_HUE: Record<string, string> = {
  '1':'#7C5CFC','2':'#9B59FC','3':'#B05AF5','4':'#C86EF0','5':'#D97BE8','6':'#E88CE0',
  '7':'#F49CD6','8':'#E8A0C8','9':'#D4A8D0','10':'#C0B0D8','11':'#AAB8E0','12':'#94C0E8',
};
const KEY_HUE_B: Record<string, string> = {
  '1':'#5C9CFC','2':'#5CB8FC','3':'#4CCCE0','4':'#3DDCC0','5':'#40DCA0','6':'#52E080',
  '7':'#6AE060','8':'#8EE040','9':'#B8E040','10':'#DCE040','11':'#ECC840','12':'#F0A040',
};

function keyColor(k: CamelotKey): string {
  const num = k.replace(/[AB]/, '');
  return k.endsWith('A') ? KEY_HUE[num] ?? C.accent : KEY_HUE_B[num] ?? C.info;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={C.accent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function KeyBadge({ camelotKey }: { camelotKey: CamelotKey }) {
  const col = keyColor(camelotKey);
  return (
    <View style={[s.keyBadge, { backgroundColor: col + '22', borderColor: col + '55' }]}>
      <Text style={[s.keyBadgeText, { color: col }]}>{camelotKey}</Text>
    </View>
  );
}

function CompatDot({ score }: { score: 0 | 1 | 2 | 3 }) {
  const col = score === 3 ? C.success : score === 2 ? C.warning : C.critical;
  return <View style={[s.compatDot, { backgroundColor: col }]} />;
}

function EnergyBar({ value }: { value: number }) {
  const col = value >= 8 ? C.critical : value >= 5 ? C.accent : C.success;
  return (
    <View style={s.energyBarTrack}>
      <View style={[s.energyBarFill, { width: `${(value / 10) * 100}%` as any, backgroundColor: col }]} />
    </View>
  );
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={[s.toggleSwitch, value && s.toggleSwitchOn]} onPress={onToggle}>
      <View style={[s.toggleThumb, value && s.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

// ─── Add Track Modal ──────────────────────────────────────────────────────────

interface AddTrackModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (track: Omit<CrateTrack, 'id' | 'createdAt'>) => void;
  prefill?: Partial<CrateTrack>; // used by Shazam integration later
}

function AddTrackModal({ visible, onClose, onAdd, prefill }: AddTrackModalProps) {
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [artist, setArtist] = useState(prefill?.artist ?? '');
  const [bpm, setBpm] = useState(prefill?.bpm?.toString() ?? '');
  const [key, setKey] = useState<CamelotKey | ''>(prefill?.camelotKey ?? '');
  const [energy, setEnergy] = useState(prefill?.energy?.toString() ?? '5');
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);

  const reset = () => {
    setTitle(''); setArtist(''); setBpm(''); setKey(''); setEnergy('5');
  };

  const handleAdd = () => {
    if (!title.trim()) { Alert.alert('Missing field', 'Track title is required.'); return; }
    const bpmInt = parseInt(bpm);
    if (!bpmInt || bpmInt < 60 || bpmInt > 220) {
      Alert.alert('Invalid BPM', 'BPM must be between 60 and 220.'); return;
    }
    if (!key) { Alert.alert('Missing field', 'Please select a Camelot key.'); return; }
    const energyInt = Math.min(10, Math.max(1, parseInt(energy) || 5));
    onAdd({ title: title.trim(), artist: artist.trim(), bpm: bpmInt, camelotKey: key, energy: energyInt, source: 'manual' });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Add track</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput style={s.fieldInput} value={title} onChangeText={setTitle}
            placeholder="Track title" placeholderTextColor={C.textMuted} />

          <Text style={s.fieldLabel}>Artist</Text>
          <TextInput style={s.fieldInput} value={artist} onChangeText={setArtist}
            placeholder="Artist name" placeholderTextColor={C.textMuted} />

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>BPM *</Text>
              <TextInput style={s.fieldInput} value={bpm} onChangeText={setBpm}
                keyboardType="number-pad" placeholder="128" placeholderTextColor={C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Energy (1–10)</Text>
              <TextInput style={s.fieldInput} value={energy} onChangeText={setEnergy}
                keyboardType="number-pad" placeholder="5" placeholderTextColor={C.textMuted} />
            </View>
          </View>

          <Text style={s.fieldLabel}>Camelot key *</Text>
          <TouchableOpacity style={s.keyPickerBtn} onPress={() => setKeyPickerOpen(!keyPickerOpen)}>
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
            <View style={s.keyGrid}>
              {(['A', 'B'] as const).map(letter => (
                <View key={letter} style={{ marginBottom: 8 }}>
                  <Text style={s.keyGroupLabel}>{letter === 'A' ? 'Minor (A)' : 'Major (B)'}</Text>
                  <View style={s.keyRow}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const k = `${i + 1}${letter}` as CamelotKey;
                      const col = keyColor(k);
                      const selected = key === k;
                      return (
                        <TouchableOpacity
                          key={k}
                          style={[s.keyOption, { backgroundColor: col + '22', borderColor: selected ? col : col + '44' }, selected && { borderWidth: 2 }]}
                          onPress={() => { setKey(k); setKeyPickerOpen(false); }}
                        >
                          <Text style={[s.keyOptionText, { color: col }]}>{k}</Text>
                          <Text style={[s.keyOptionSub, { color: col + 'AA' }]}>{KEY_NAMES[k]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={[s.twoCol, { marginTop: 24 }]}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleAdd}>
              <Ionicons name="add-circle" size={16} color={C.accent} style={{ marginRight: 6 }} />
              <Text style={s.confirmBtnText}>Add to crate</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Camelot Wheel Modal ──────────────────────────────────────────────────────

function CamelotWheelModal({ visible, onClose, selectedKey, onSelect }:
  { visible: boolean; onClose: () => void; selectedKey?: CamelotKey; onSelect?: (k: CamelotKey) => void }) {

  const [activeKey, setActiveKey] = useState<CamelotKey | null>(selectedKey ?? null);

  const compatKeys = activeKey ? CAMELOT_KEYS.filter(k => keyCompat(activeKey, k) >= 2) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Camelot wheel</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }}>
          <Text style={s.cardSub}>Tap a key to see compatible transitions. Inner = minor, outer = major.</Text>

          {(['A', 'B'] as const).map(letter => (
            <View key={letter} style={[s.card, { marginBottom: 12 }]}>
              <Text style={s.keyGroupLabel}>{letter === 'A' ? '● Minor keys (A)' : '● Major keys (B)'}</Text>
              <View style={s.keyRow}>
                {Array.from({ length: 12 }, (_, i) => {
                  const k = `${i + 1}${letter}` as CamelotKey;
                  const col = keyColor(k);
                  const isActive = activeKey === k;
                  const isCompat = activeKey && compatKeys.includes(k) && !isActive;
                  const isDim = activeKey && !compatKeys.includes(k) && !isActive;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[
                        s.wheelKey,
                        { backgroundColor: col + '22', borderColor: col + '55' },
                        isActive && { backgroundColor: col + '44', borderColor: col, borderWidth: 2 },
                        isCompat && { backgroundColor: col + '33', borderColor: col + '99' },
                        isDim && { opacity: 0.3 },
                      ]}
                      onPress={() => setActiveKey(activeKey === k ? null : k)}
                    >
                      <Text style={[s.wheelKeyText, { color: col }]}>{k}</Text>
                      <Text style={[s.wheelKeySub, { color: col + 'BB' }]}>{KEY_NAMES[k]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {activeKey && (
            <View style={s.card}>
              <SectionHeader icon="git-merge-outline" title={`${activeKey} — ${KEY_NAMES[activeKey]} transitions`} />
              {compatKeys.map(k => {
                const score = keyCompat(activeKey, k);
                const col = score === 3 ? C.success : C.warning;
                const label = score === 3 ? 'Harmonic' : 'Close';
                return (
                  <View key={k} style={s.compatRow}>
                    <KeyBadge camelotKey={k} />
                    <Text style={s.compatName}>{KEY_NAMES[k]}</Text>
                    <View style={[s.compatTag, { backgroundColor: col + '18', borderColor: col + '44' }]}>
                      <Text style={[s.compatTagText, { color: col }]}>{label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={s.card}>
            <SectionHeader icon="information-circle-outline" title="Compatibility rules" />
            {[
              { col: C.success, label: 'Same number, A↔B — relative major/minor (perfect)' },
              { col: C.success, label: '±1 same letter — adjacent key (very smooth)' },
              { col: C.warning, label: '±2 same letter — one step away (works well)' },
              { col: C.critical, label: 'Everything else — clashing (avoid or use FX)' },
            ].map((r, i) => (
              <View key={i} style={[s.rowBetween, { marginBottom: 8, justifyContent: 'flex-start', gap: 10 }]}>
                <View style={[s.compatDot, { backgroundColor: r.col }]} />
                <Text style={s.cardSub}>{r.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type TabId = 'crate' | 'set' | 'saved';

export default function SetBuilderScreen() {
  const {
    crate, addTrack, removeTrack,
    targetLength, setTargetLength,
    generatedSet, generateSet, clearSet,
    savedSets, saveCurrentSet, deleteSavedSet,
    syncing, syncError,
    syncCrateToSupabase, saveSetToSupabase, loadCrateFromSupabase,
  } = useSetBuilderStore();

  const { user } = useAuthStore();

  const [tab, setTab] = useState<TabId>('crate');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [setNameInput, setSetNameInput] = useState('');
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [setView, setSetView] = useState<'list' | 'energy' | 'chain'>('list');

  const SET_LENGTHS: { label: string; value: SetLength }[] = [
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '3 hours', value: 180 },
    { label: 'All tracks', value: 0 },
  ];

  const TRACK_MINS = 6;
  const estimatedTracks = targetLength === 0 ? crate.length : Math.ceil(targetLength / TRACK_MINS);

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (crate.length < 2) {
      Alert.alert('Not enough tracks', 'Add at least 2 tracks to your crate first.');
      return;
    }
    generateSet();
    setTab('set');
  };

  // ── Save set ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!generatedSet) return;
    setSaveNameOpen(true);
    setSetNameInput(`Set ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
  };

  const confirmSave = async () => {
    const name = setNameInput.trim() || 'Untitled Set';
    saveCurrentSet(name);
    setSaveNameOpen(false);
    if (user && generatedSet) {
      await saveSetToSupabase({ ...generatedSet, name }, user.id);
    }
  };

  // ── Export / share ──────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!generatedSet) return;
    const lines = [
      `🎧 Cuerate Set — ${generatedSet.name}`,
      `${generatedSet.tracks.length} tracks · ~${generatedSet.tracks.length * TRACK_MINS} min · ${generatedSet.harmonicScore}% harmonic flow`,
      '',
      ...generatedSet.tracks.map((t, i) =>
        `${i + 1}. ${t.title}${t.artist ? ` — ${t.artist}` : ''} | ${t.camelotKey} | ${t.bpm} BPM`
      ),
      '',
      'Built with Cuerate · cuerate.co.uk',
    ];
    await Share.share({ message: lines.join('\n'), title: generatedSet.name });
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderTransitionLabel = (prev: CrateTrack, curr: CrateTrack) => {
    const ks = keyCompat(prev.camelotKey, curr.camelotKey);
    const bpmDiff = curr.bpm - prev.bpm;
    const ksLabel = ks === 3 ? 'harmonic' : ks === 2 ? 'close' : 'clash';
    const ksColor = ks === 3 ? C.success : ks === 2 ? C.warning : C.critical;
    const arrow = bpmDiff > 0 ? '▲' : bpmDiff < 0 ? '▼' : '→';
    const arrowColor = Math.abs(bpmDiff) <= 3 ? C.success : bpmDiff > 0 ? C.warning : C.info;
    return (
      <View style={s.transRow}>
        <Text style={[s.transArrow, { color: arrowColor }]}>{arrow}{Math.abs(bpmDiff)}</Text>
        <View style={[s.transTag, { backgroundColor: ksColor + '18', borderColor: ksColor + '55' }]}>
          <Text style={[s.transTagText, { color: ksColor }]}>{ksLabel}</Text>
        </View>
      </View>
    );
  };

  // ── Crate tab ───────────────────────────────────────────────────────────────
  const renderCrate = () => (
    <>
      <View style={[s.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View>
          <Text style={s.sectionTitle}>{crate.length} {crate.length === 1 ? 'track' : 'tracks'} in crate</Text>
          <Text style={s.cardSub}>Targeting ~{estimatedTracks} tracks for {targetLength === 0 ? 'full crate' : `${targetLength} min`}</Text>
        </View>
        <TouchableOpacity style={s.addCostBtn} onPress={() => setAddModalOpen(true)}>
          <Ionicons name="add" size={16} color={C.accent} />
          <Text style={s.addCostBtnText}>Add track</Text>
        </TouchableOpacity>
      </View>

      {/* Set length selector */}
      <View style={s.card}>
        <SectionHeader icon="time-outline" title="Target set length" />
        <View style={s.lenRow}>
          {SET_LENGTHS.map(l => (
            <TouchableOpacity
              key={l.value}
              style={[s.lenBtn, targetLength === l.value && s.lenBtnActive]}
              onPress={() => setTargetLength(l.value)}
            >
              <Text style={[s.lenBtnText, targetLength === l.value && s.lenBtnTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Track list */}
      {crate.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="disc-outline" size={40} color={C.textMuted} />
          <Text style={s.emptyTitle}>Crate is empty</Text>
          <Text style={s.emptyBody}>Add tracks manually, or use Shazam (coming soon) to identify and save tracks on the fly.</Text>
          <TouchableOpacity style={s.confirmBtn} onPress={() => setAddModalOpen(true)}>
            <Ionicons name="add-circle-outline" size={16} color={C.accent} style={{ marginRight: 6 }} />
            <Text style={s.confirmBtnText}>Add your first track</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {crate.map((track) => (
            <View key={track.id} style={s.trackRow}>
              <KeyBadge camelotKey={track.camelotKey} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
                {track.artist ? <Text style={s.trackArtist}>{track.artist}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.trackBpm}>{track.bpm} BPM</Text>
                <EnergyBar value={track.energy} />
              </View>
              <TouchableOpacity style={s.deleteBtn} onPress={() => removeTrack(track.id)}>
                <Ionicons name="close-circle" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 8 }} />
          <TouchableOpacity
            style={[s.confirmBtn, { justifyContent: 'center', paddingVertical: 14 }]}
            onPress={handleGenerate}
          >
            <Ionicons name="sparkles" size={16} color={C.accent} style={{ marginRight: 8 }} />
            <Text style={[s.confirmBtnText, { fontSize: 15 }]}>Generate set</Text>
          </TouchableOpacity>
          <Text style={[s.cardSub, { textAlign: 'center', marginTop: 6 }]}>
            Orders tracks by harmonic key + BPM flow
          </Text>
        </>
      )}
    </>
  );

  // ── Set tab ─────────────────────────────────────────────────────────────────
  const renderSet = () => {
    if (!generatedSet) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="list-outline" size={40} color={C.textMuted} />
          <Text style={s.emptyTitle}>No set generated yet</Text>
          <Text style={s.emptyBody}>Add tracks to your crate and hit generate.</Text>
          <TouchableOpacity style={s.confirmBtn} onPress={() => setTab('crate')}>
            <Text style={s.confirmBtnText}>Go to crate</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const { tracks, harmonicScore } = generatedSet;
    const scoreColor = harmonicScore >= 80 ? C.success : harmonicScore >= 60 ? C.warning : C.critical;

    return (
      <>
        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{tracks.length}</Text>
            <Text style={s.statLabel}>tracks</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>~{tracks.length * TRACK_MINS}m</Text>
            <Text style={s.statLabel}>duration</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: scoreColor }]}>{harmonicScore}%</Text>
            <Text style={s.statLabel}>harmonic flow</Text>
          </View>
        </View>

        {/* View toggle */}
        <View style={s.viewToggleRow}>
          {(['list', 'energy', 'chain'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[s.viewToggleBtn, setView === v && s.viewToggleBtnActive]}
              onPress={() => setSetView(v)}
            >
              <Text style={[s.viewToggleText, setView === v && s.viewToggleTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List view */}
        {setView === 'list' && tracks.map((track, i) => (
          <View key={track.id} style={s.trackRow}>
            <Text style={s.trackNum}>{i + 1}</Text>
            <KeyBadge camelotKey={track.camelotKey} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {track.artist ? <Text style={s.trackArtist}>{track.artist}</Text> : null}
                {i > 0 && renderTransitionLabel(tracks[i - 1], track)}
              </View>
            </View>
            <Text style={s.trackBpm}>{track.bpm} BPM</Text>
          </View>
        ))}

        {/* Energy view */}
        {setView === 'energy' && (
          <View style={s.card}>
            <SectionHeader icon="pulse-outline" title="Energy curve" />
            {tracks.map((track, i) => (
              <View key={track.id} style={s.energyRow}>
                <Text style={[s.trackNum, { width: 24 }]}>{i + 1}</Text>
                <Text style={[s.trackTitle, { width: 100, fontSize: 11 }]} numberOfLines={1}>{track.title}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={s.energyBarTrack}>
                    <View style={[s.energyBarFill, {
                      width: `${(track.energy / 10) * 100}%` as any,
                      backgroundColor: track.energy >= 8 ? C.critical : track.energy >= 5 ? C.accent : C.success,
                    }]} />
                  </View>
                  <Text style={[s.trackBpm, { minWidth: 16 }]}>E{track.energy}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Key chain view */}
        {setView === 'chain' && (
          <View style={s.card}>
            <SectionHeader icon="link-outline" title="Key chain" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', paddingBottom: 4 }}>
                {tracks.map((track, i) => {
                  const col = keyColor(track.camelotKey);
                  const ks = i > 0 ? keyCompat(tracks[i - 1].camelotKey, track.camelotKey) : 3;
                  const arrowCol = ks === 3 ? C.success : ks === 2 ? C.warning : C.critical;
                  return (
                    <React.Fragment key={track.id}>
                      {i > 0 && <Text style={[s.chainArrow, { color: arrowCol }]}>→</Text>}
                      <View style={[s.keyChip, { backgroundColor: col + '18', borderColor: col + '44' }]}>
                        <Text style={[s.keyChipText, { color: col }]}>{track.camelotKey}</Text>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            </ScrollView>
            {tracks.slice(1).map((track, i) => {
              const prev = tracks[i];
              const ks = keyCompat(prev.camelotKey, track.camelotKey);
              const col = ks === 3 ? C.success : ks === 2 ? C.warning : C.critical;
              const label = ks === 3 ? 'Harmonic ✓' : ks === 2 ? 'Close' : 'Clashing ✗';
              const bpmDiff = track.bpm - prev.bpm;
              return (
                <View key={track.id} style={s.chainDetailRow}>
                  <Text style={[s.chainDetailKey, { color: col }]}>{prev.camelotKey}→{track.camelotKey}</Text>
                  <Text style={s.chainDetailLabel}>{label}</Text>
                  <Text style={[s.chainDetailBpm, { color: C.textMuted }]}>
                    {bpmDiff >= 0 ? '+' : ''}{bpmDiff} BPM
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Actions */}
        <View style={s.setActions}>
          <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={handleSave}>
            <Ionicons name="bookmark-outline" size={16} color={C.accent} />
            <Text style={s.actionBtnText}>Save set</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={16} color={C.accent} />
            <Text style={s.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={handleGenerate}>
            <Ionicons name="refresh-outline" size={16} color={C.textSec} />
            <Text style={[s.actionBtnText, { color: C.textSec }]}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── Saved sets tab ──────────────────────────────────────────────────────────
  const renderSaved = () => (
    savedSets.length === 0 ? (
      <View style={s.emptyState}>
        <Ionicons name="bookmark-outline" size={40} color={C.textMuted} />
        <Text style={s.emptyTitle}>No saved sets</Text>
        <Text style={s.emptyBody}>Generate a set and save it to see it here.</Text>
      </View>
    ) : (
      savedSets.map(ss => (
        <View key={ss.id} style={s.savedCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.savedName}>{ss.name}</Text>
            <Text style={s.savedMeta}>
              {ss.tracks.length} tracks · ~{ss.tracks.length * TRACK_MINS} min · {ss.harmonicScore}% flow
              {ss.savedToSupabase ? ' · ☁️ synced' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {ss.tracks.slice(0, 8).map((t, i) => {
                  const col = keyColor(t.camelotKey);
                  return (
                    <View key={i} style={[s.keyChip, { backgroundColor: col + '18', borderColor: col + '44' }]}>
                      <Text style={[s.keyChipText, { color: col }]}>{t.camelotKey}</Text>
                    </View>
                  );
                })}
                {ss.tracks.length > 8 && (
                  <Text style={[s.keyChipText, { color: C.textMuted, alignSelf: 'center', marginLeft: 4 }]}>
                    +{ss.tracks.length - 8}
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Delete set', `Delete "${ss.name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteSavedSet(ss.id) },
            ])}
          >
            <Ionicons name="trash-outline" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      ))
    )
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>Cuerate</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.title}>Set Builder</Text>
            <TouchableOpacity onPress={() => setWheelOpen(true)} style={s.wheelBtn}>
              <Ionicons name="radio-button-on-outline" size={18} color={C.accent} />
              <Text style={s.wheelBtnText}>Camelot</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sync error */}
        {syncError ? (
          <View style={[s.alertBox, { marginBottom: 12 }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={C.critical} />
            <Text style={s.alertText}>Sync error: {syncError}</Text>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={s.tabRow}>
          {([
            { id: 'crate', icon: 'musical-notes-outline', label: 'Crate' },
            { id: 'set', icon: 'list-outline', label: 'Set' },
            { id: 'saved', icon: 'bookmark-outline', label: 'Saved' },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
              onPress={() => setTab(t.id)}
            >
              <Ionicons name={t.icon as any} size={15} color={tab === t.id ? C.accent : C.textSec} />
              <Text style={[s.tabBtnText, tab === t.id && s.tabBtnTextActive]}>{t.label}</Text>
              {t.id === 'crate' && crate.length > 0 && (
                <View style={s.tabBadge}><Text style={s.tabBadgeText}>{crate.length}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'crate' && renderCrate()}
        {tab === 'set' && renderSet()}
        {tab === 'saved' && renderSaved()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Save name modal (inline Alert alternative) */}
      <Modal visible={saveNameOpen} transparent animationType="fade">
        <View style={s.saveOverlay}>
          <View style={s.saveDialog}>
            <Text style={s.savedName}>Name this set</Text>
            <TextInput
              style={[s.fieldInput, { marginTop: 12, marginBottom: 16 }]}
              value={setNameInput}
              onChangeText={setSetNameInput}
              placeholder="e.g. Fabric warm-up"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <View style={s.twoCol}>
              <TouchableOpacity style={[s.cancelBtn, { flex: 1 }]} onPress={() => setSaveNameOpen(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, { flex: 1 }]} onPress={confirmSave}>
                {syncing
                  ? <ActivityIndicator size="small" color={C.accent} />
                  : <Text style={s.confirmBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddTrackModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={addTrack}
      />

      <CamelotWheelModal
        visible={wheelOpen}
        onClose={() => setWheelOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  header: { marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  cardSub: { fontSize: 12, color: C.textMuted, marginBottom: 0, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 16, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 9 },
  tabBtnActive: { backgroundColor: C.raised },
  tabBtnText: { fontSize: 13, color: C.textSec, fontWeight: '500' },
  tabBtnTextActive: { color: C.accent },
  tabBadge: { backgroundColor: C.accentDim, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, color: C.accent, fontWeight: '700' },
  // Set length
  lenRow: { flexDirection: 'row', gap: 6 },
  lenBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  lenBtnActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  lenBtnText: { fontSize: 12, color: C.textSec, fontWeight: '500' },
  lenBtnTextActive: { color: C.accent },
  // Track row
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 6 },
  trackNum: { fontSize: 12, color: C.textMuted, minWidth: 16, textAlign: 'center' },
  trackTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  trackArtist: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  trackBpm: { fontSize: 12, color: C.textSec },
  deleteBtn: { padding: 2 },
  // Key badge
  keyBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  keyBadgeText: { fontSize: 11, fontWeight: '700' },
  // Energy bar
  energyBarTrack: { flex: 1, height: 3, backgroundColor: C.raised, borderRadius: 2, overflow: 'hidden' },
  energyBarFill: { height: '100%', borderRadius: 2 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  // View toggle
  viewToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  viewToggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  viewToggleBtnActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  viewToggleText: { fontSize: 12, color: C.textSec, fontWeight: '500' },
  viewToggleTextActive: { color: C.accent },
  // Transition labels
  transRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  transArrow: { fontSize: 10, fontWeight: '700' },
  transTag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  transTagText: { fontSize: 10, fontWeight: '600' },
  // Compat
  compatDot: { width: 8, height: 8, borderRadius: 4 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  compatName: { flex: 1, fontSize: 13, color: C.text },
  compatTag: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  compatTagText: { fontSize: 11, fontWeight: '600' },
  // Energy view
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  // Key chain
  chainArrow: { fontSize: 14, marginHorizontal: 2 },
  keyChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  keyChipText: { fontSize: 11, fontWeight: '700' },
  chainDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  chainDetailKey: { fontSize: 12, fontWeight: '700', width: 64 },
  chainDetailLabel: { flex: 1, fontSize: 12, color: C.textSec },
  chainDetailBpm: { fontSize: 12 },
  // Actions
  setActions: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 12 },
  actionBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  // Saved sets
  savedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  savedName: { fontSize: 15, fontWeight: '600', color: C.text },
  savedMeta: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  // Add cost btn (reuse GigCalc style)
  addCostBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  addCostBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptyBody: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  // Alert
  alertBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.criticalBg, borderRadius: 8, borderWidth: 1, borderColor: C.critical, padding: 10 },
  alertText: { fontSize: 12, color: C.critical, flex: 1, lineHeight: 17 },
  // Toggle
  toggleSwitch: { width: 44, height: 26, borderRadius: 13, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleSwitchOn: { backgroundColor: C.accentDim },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.textMuted },
  toggleThumbOn: { backgroundColor: C.accent, alignSelf: 'flex-end' },
  // Wheel button
  wheelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  wheelBtnText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  fieldLabel: { fontSize: 12, color: C.textMuted, marginBottom: 6, marginTop: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 44, fontSize: 14, color: C.text },
  twoCol: { flexDirection: 'row', gap: 10 },
  keyPickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 44 },
  keyGrid: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 8 },
  keyGroupLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  keyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  keyOption: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', minWidth: 48 },
  keyOptionText: { fontSize: 12, fontWeight: '700' },
  keyOptionSub: { fontSize: 9, marginTop: 1 },
  wheelKey: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center', minWidth: 46, marginBottom: 4 },
  wheelKeyText: { fontSize: 11, fontWeight: '700' },
  wheelKeySub: { fontSize: 9, marginTop: 1 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent },
  confirmBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  saveOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  saveDialog: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20 },
});
