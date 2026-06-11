import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRigStore, RigMode, GigProfile } from '../store/rigStore';
import { useAuthStore } from '../store/authStore';
import { generateAndShareRider, buildRiderDataFromGig, buildRiderDataFromHome } from '../utils/riderGenerator';
import { GEAR_DATABASE, GearItem, ConnectionType, GearCategory, CompatibilityWarning } from '../data/gearDatabase';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', borderBright: '#3D3D54',
  accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  warning: '#F5A623', warningBg: '#1F1508',
  info: '#4DB8FF', infoBg: '#0A1929',
  success: '#4DCC8F', successBg: '#071A0F',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const CATEGORY_LABELS: Partial<Record<GearCategory, string>> = {
  controller: 'Controller', mixer: 'Mixer', cdj: 'CDJ / Standalone',
  speaker: 'Speaker / Monitor', subwoofer: 'Subwoofer', soundbar: 'Soundbar',
  headphones: 'Headphones', laptop: 'Laptop / Device', amplifier: 'Amplifier',
};

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  xlr: 'XLR', trs: 'TRS / Jack', rca: 'RCA', usb: 'USB',
  bluetooth: 'Bluetooth', hdmi: 'HDMI ARC', optical: 'Optical', phono: 'Phono',
};

// ─── Warning Card ─────────────────────────────────────────────────────────────
function WarningCard({ w }: { w: CompatibilityWarning }) {
  const cfg = {
    critical: { bg: C.criticalBg, border: C.critical, text: C.critical, icon: 'alert-circle' as const },
    warning: { bg: C.warningBg, border: C.warning, text: C.warning, icon: 'warning' as const },
    info: { bg: C.infoBg, border: C.info, text: C.info, icon: 'information-circle' as const },
  }[w.severity];
  return (
    <View style={[s.warnCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={s.warnHeader}>
        <Ionicons name={cfg.icon} size={15} color={cfg.text} />
        <Text style={[s.warnLabel, { color: cfg.text }]}>
          {w.severity === 'critical' ? 'Critical' : w.severity === 'warning' ? 'Warning' : 'Tip'}
          {w.latencyMs ? ` · ${w.latencyMs}ms latency` : ''}
        </Text>
      </View>
      <Text style={s.warnMsg}>{w.message}</Text>
      <View style={s.warnFixRow}>
        <Ionicons name="bulb-outline" size={12} color={C.success} />
        <Text style={s.warnFix}>{w.fix}</Text>
      </View>
    </View>
  );
}

// ─── Gear Chip ────────────────────────────────────────────────────────────────
function GearChip({ gear, conn, onRemove, onChangeConn }: {
  gear: GearItem; conn?: ConnectionType;
  onRemove: () => void; onChangeConn?: (c: ConnectionType) => void;
}) {
  const [showConn, setShowConn] = useState(false);
  return (
    <View style={s.chip}>
      <View style={{ flex: 1 }}>
        <Text style={s.chipBrand}>{gear.brand}</Text>
        <Text style={s.chipModel}>{gear.model}</Text>
        {gear.category === 'headphones' && gear.impedanceOhms && (
          <Text style={s.chipMeta}>{gear.impedanceOhms}Ω · {gear.driverMm}mm driver</Text>
        )}
        {gear.category === 'laptop' && gear.os && (
          <Text style={s.chipMeta}>{gear.softwareCompatibility?.slice(0, 2).join(', ')}</Text>
        )}
        {conn && (
          <TouchableOpacity onPress={() => setShowConn(true)} style={s.connBadge}>
            <Ionicons name="git-branch-outline" size={11} color={C.accent} />
            <Text style={s.connBadgeText}>{CONNECTION_LABELS[conn]}</Text>
            <Ionicons name="chevron-down" size={11} color={C.accent} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={12}>
        <Ionicons name="close" size={16} color={C.textMuted} />
      </TouchableOpacity>
      <Modal visible={showConn} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} onPress={() => setShowConn(false)} activeOpacity={1}>
          <View style={s.connMenu}>
            <Text style={s.connMenuTitle}>Connection type</Text>
            {gear.connections.map(c => (
              <TouchableOpacity key={c} style={[s.connOpt, conn === c && s.connOptActive]}
                onPress={() => { onChangeConn?.(c); setShowConn(false); }}>
                <Text style={[s.connOptText, conn === c && { color: C.accent }]}>{CONNECTION_LABELS[c]}</Text>
                {conn === c && <Ionicons name="checkmark" size={16} color={C.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Gear Section ─────────────────────────────────────────────────────────────
function GearSection({ label, gear, conn, onAdd, onRemove, onChangeConn, single = false }: {
  label: string; gear: GearItem | GearItem[] | null;
  conn?: Record<string, ConnectionType>;
  onAdd: () => void; onRemove: (id: string) => void;
  onChangeConn?: (id: string, c: ConnectionType) => void;
  single?: boolean;
}) {
  const items = gear === null ? [] : Array.isArray(gear) ? gear : [gear];
  return (
    <View style={s.section}>
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>{label}</Text>
        {(!single || items.length === 0) && (
          <TouchableOpacity style={s.addBtn} onPress={onAdd}>
            <Ionicons name="add" size={14} color={C.accent} />
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {items.length === 0 ? (
        <TouchableOpacity style={s.addSlot} onPress={onAdd}>
          <Ionicons name="add-circle-outline" size={18} color={C.accent} />
          <Text style={s.addSlotText}>Add {label.toLowerCase()}</Text>
        </TouchableOpacity>
      ) : (
        items.map(item => (
          <GearChip key={item.id} gear={item}
            conn={conn?.[item.id]}
            onRemove={() => onRemove(item.id)}
            onChangeConn={onChangeConn ? (c) => onChangeConn(item.id, c) : undefined}
          />
        ))
      )}
    </View>
  );
}

// ─── Gear Picker Modal ────────────────────────────────────────────────────────
function GearPickerModal({ visible, categories, title, onSelect, onClose }: {
  visible: boolean; categories: GearCategory[]; title: string;
  onSelect: (g: GearItem) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() =>
    GEAR_DATABASE.filter(g =>
      categories.includes(g.category) &&
      (query === '' || `${g.brand} ${g.model}`.toLowerCase().includes(query.toLowerCase()))
    ), [categories, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.sheet} edges={['top']}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={() => { onClose(); setQuery(''); }} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={C.textMuted} />
          <TextInput style={s.searchInput} placeholder="Search..." placeholderTextColor={C.textMuted}
            value={query} onChangeText={setQuery} autoFocus />
        </View>
        <FlatList data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.gearRow} onPress={() => { onSelect(item); onClose(); setQuery(''); }}>
              <View style={{ flex: 1 }}>
                <Text style={s.gearRowCat}>{CATEGORY_LABELS[item.category]}</Text>
                <Text style={s.gearRowName}>{item.brand} {item.model}</Text>
                <Text style={s.gearRowMeta}>
                  {item.category === 'headphones'
                    ? `${item.impedanceOhms}Ω · ${item.driverMm}mm`
                    : item.category === 'laptop'
                    ? item.softwareCompatibility?.slice(0, 2).join(', ')
                    : `${item.powerDraw}W · ${item.connections.map(c => c.toUpperCase()).join(', ')}`
                  }
                </Text>
              </View>
              {item.warningFlags && item.warningFlags.length > 0 && (
                <Ionicons name="warning" size={15} color={C.warning} style={{ marginRight: 4 }} />
              )}
              <Ionicons name="chevron-forward" size={15} color={C.textMuted} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Gig Profile Picker ───────────────────────────────────────────────────────
function GigProfileBar({ profiles, activeId, onSelect, onCreate }: {
  profiles: GigProfile[]; activeId: string | null;
  onSelect: (id: string) => void; onCreate: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {profiles.map(p => (
        <TouchableOpacity key={p.id}
          style={[s.gigPill, activeId === p.id && s.gigPillActive]}
          onPress={() => onSelect(p.id)}>
          <Text style={[s.gigPillText, activeId === p.id && { color: C.accent }]}>{p.name}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={s.gigPillNew} onPress={onCreate}>
        <Ionicons name="add" size={14} color={C.accent} />
        <Text style={s.addBtnText}>New rig</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Power Meter ──────────────────────────────────────────────────────────────
function PowerMeter({ watts }: { watts: number }) {
  const pct = Math.min(watts / 2000, 1);
  const color = pct > 0.85 ? C.critical : pct > 0.5 ? C.warning : C.success;
  return (
    <View style={s.powerMeter}>
      <View style={s.powerRow}>
        <Text style={s.powerLabel}>Total power draw</Text>
        <Text style={[s.powerValue, { color }]}>{watts}W</Text>
      </View>
      <View style={s.meterTrack}>
        <View style={[s.meterFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={s.powerHint}>
        {watts === 0 ? 'Add gear to see power draw' : `Needs ${Math.ceil(watts / 800)}kW+ power supply for outdoor use`}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HardwareLockerScreen() {
  const store = useRigStore();
  const { mode, warnings, totalPowerDraw } = store;
  const { profile, user } = useAuthStore();
  const [riderLoading, setRiderLoading] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [riderGigName, setRiderGigName] = useState('');
  const [riderDate, setRiderDate] = useState('');
  const [riderVenue, setRiderVenue] = useState('');

  const [picker, setPicker] = useState<{
    visible: boolean; categories: GearCategory[]; title: string; onSelect: (g: GearItem) => void;
  }>({ visible: false, categories: [], title: '', onSelect: () => {} });

  const activeGig = store.gigProfiles.find(p => p.id === store.activeGigId) ?? null;

  function openPicker(categories: GearCategory[], title: string, onSelect: (g: GearItem) => void) {
    setPicker({ visible: true, categories, title, onSelect });
  }

  function createNewGig() {
    Alert.prompt('New gig profile', 'Name your rig (e.g. Pub Gig, Festival, Wedding)',
      (name) => { if (name?.trim()) store.createGigProfile(name.trim()); },
      'plain-text', '', 'default'
    );
  }

  const criticals = warnings.filter(w => w.severity === 'critical').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>Hardware Locker</Text>
            <Text style={s.title}>Your Rig</Text>
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {criticals > 0 && (
              <View style={[s.badge, { backgroundColor: C.criticalBg, borderColor: C.critical }]}>
                <Text style={[s.badgeText, { color: C.critical }]}>{criticals} critical</Text>
              </View>
            )}
            {warningCount > 0 && (
              <View style={[s.badge, { backgroundColor: C.warningBg, borderColor: C.warning }]}>
                <Text style={[s.badgeText, { color: C.warning }]}>{warningCount} warning</Text>
              </View>
            )}
            {warnings.length === 0 && (mode === 'home' ? store.homeController : activeGig?.controller) && (
              <View style={[s.badge, { backgroundColor: C.successBg, borderColor: C.success }]}>
                <Ionicons name="checkmark-circle" size={12} color={C.success} />
                <Text style={[s.badgeText, { color: C.success, marginLeft: 4 }]}>Rig OK</Text>
              </View>
            )}
          </View>
        </View>

        {/* Home / Gig Toggle */}
        <View style={s.toggle}>
          {(['home', 'gig'] as RigMode[]).map(m => (
            <TouchableOpacity key={m} style={[s.toggleBtn, mode === m && s.toggleBtnActive]}
              onPress={() => store.setMode(m)}>
              <Ionicons
                name={m === 'home' ? 'home-outline' : 'musical-notes-outline'}
                size={15} color={mode === m ? C.accent : C.textMuted}
              />
              <Text style={[s.toggleText, mode === m && { color: C.accent }]}>
                {m === 'home' ? 'Home Setup' : 'Gig Setup'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── HOME MODE ── */}
        {mode === 'home' && (
          <>
            <GearSection label="Laptop / Device" single
              gear={store.homeLaptop}
              onAdd={() => openPicker(['laptop'], 'Select laptop or device', store.setHomeLaptop)}
              onRemove={() => store.setHomeLaptop(null)}
            />
            <GearSection label="Controller / CDJ" single
              gear={store.homeController}
              onAdd={() => openPicker(['controller', 'cdj', 'mixer'], 'Select controller or CDJ', store.setHomeController)}
              onRemove={() => store.setHomeController(null)}
            />
            <GearSection label="Studio Monitors" gear={store.homeSpeakers}
              conn={store.homeConnections}
              onAdd={() => openPicker(['speaker', 'soundbar'], 'Add monitor or speaker', store.addHomeSpeaker)}
              onRemove={store.removeHomeSpeaker}
              onChangeConn={(id, c) => store.setHomeConnection(id, c)}
            />
            <GearSection label="Headphones" single
              gear={store.homeHeadphones}
              onAdd={() => openPicker(['headphones'], 'Select headphones', store.setHomeHeadphones)}
              onRemove={() => store.setHomeHeadphones(null)}
            />
          </>
        )}

        {/* ── GIG MODE ── */}
        {mode === 'gig' && (
          <>
            <GigProfileBar
              profiles={store.gigProfiles}
              activeId={store.activeGigId}
              onSelect={store.setActiveGig}
              onCreate={createNewGig}
            />

            {store.gigProfiles.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="musical-notes-outline" size={44} color={C.textMuted} />
                <Text style={s.emptyTitle}>No gig rigs yet</Text>
                <Text style={s.emptyBody}>Create a named rig for each type of gig — pub, festival, wedding, etc.</Text>
                <TouchableOpacity style={s.createBtn} onPress={createNewGig}>
                  <Ionicons name="add" size={16} color={C.accent} />
                  <Text style={s.createBtnText}>Create your first gig rig</Text>
                </TouchableOpacity>
              </View>
            ) : activeGig ? (
              <>
                <GearSection label="Controller / CDJ" single
                  gear={activeGig.controller}
                  onAdd={() => openPicker(['controller', 'cdj'], 'Select controller or CDJ',
                    (g) => store.updateGigController(activeGig.id, g))}
                  onRemove={() => store.updateGigController(activeGig.id, null)}
                />
                <GearSection label="Mixer" single
                  gear={activeGig.mixer}
                  onAdd={() => openPicker(['mixer'], 'Select mixer',
                    (g) => store.setGigMixer(activeGig.id, g))}
                  onRemove={() => store.setGigMixer(activeGig.id, null)}
                />
                <GearSection label="PA Speakers" gear={activeGig.speakers.filter(s => s.category === 'speaker')}
                  conn={activeGig.activeConnections}
                  onAdd={() => openPicker(['speaker'], 'Add PA speaker',
                    (g) => store.addGigSpeaker(activeGig.id, g))}
                  onRemove={(id) => store.removeGigSpeaker(activeGig.id, id)}
                  onChangeConn={(id, c) => store.setGigConnection(activeGig.id, id, c)}
                />
                <GearSection label="Subwoofers" gear={activeGig.speakers.filter(s => s.category === 'subwoofer')}
                  conn={activeGig.activeConnections}
                  onAdd={() => openPicker(['subwoofer'], 'Add subwoofer',
                    (g) => store.addGigSpeaker(activeGig.id, g))}
                  onRemove={(id) => store.removeGigSpeaker(activeGig.id, id)}
                  onChangeConn={(id, c) => store.setGigConnection(activeGig.id, id, c)}
                />
                <GearSection label="Amplifiers" gear={activeGig.speakers.filter(s => s.category === 'amplifier')}
                  conn={activeGig.activeConnections}
                  onAdd={() => openPicker(['amplifier'], 'Add amplifier',
                    (g) => store.addGigSpeaker(activeGig.id, g))}
                  onRemove={(id) => store.removeGigSpeaker(activeGig.id, id)}
                  onChangeConn={(id, c) => store.setGigConnection(activeGig.id, id, c)}
                />
                <TouchableOpacity style={s.deleteGigBtn}
                  onPress={() => Alert.alert('Delete rig', `Delete "${activeGig.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => store.deleteGigProfile(activeGig.id) },
                  ])}>
                  <Ionicons name="trash-outline" size={14} color={C.critical} />
                  <Text style={s.deleteGigText}>Delete this rig</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}

        {/* Power + Warnings */}
        {totalPowerDraw > 0 && <PowerMeter watts={totalPowerDraw} />}
        {warnings.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Bottleneck Analysis</Text>
            {warnings.map((w, i) => <WarningCard key={i} w={w} />)}
          </View>
        )}

        {/* Generate Rider button */}
        {(totalPowerDraw > 0 || (mode === 'gig' && store.activeGigId)) && (
          <TouchableOpacity
            style={s.riderBtn}
            onPress={() => setShowRiderModal(true)}
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <Text style={s.riderBtnText}>Generate Technical Rider</Text>
          </TouchableOpacity>
        )}

        {mode === 'home' && !store.homeController && store.homeSpeakers.length === 0 && !store.homeLaptop && (
          <View style={s.emptyState}>
            <Ionicons name="hardware-chip-outline" size={44} color={C.textMuted} />
            <Text style={s.emptyTitle}>Lock in your home rig</Text>
            <Text style={s.emptyBody}>Add your laptop, controller, monitors, and headphones. BoothBuddy will flag any issues.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rider details modal */}
      <Modal visible={showRiderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.riderModal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.sheetTitle}>Technical Rider</Text>
              <TouchableOpacity onPress={() => setShowRiderModal(false)}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 16, lineHeight: 17 }}>
              Optional details to include on the rider. Leave blank to generate without them.
            </Text>
            <Text style={s.riderFieldLabel}>Event / Gig name</Text>
            <View style={s.riderFieldRow}>
              <TextInput style={s.riderField} value={riderGigName} onChangeText={setRiderGigName}
                placeholder="e.g. Fabric Warm-up, Wedding, Festival" placeholderTextColor={C.textMuted} />
            </View>
            <Text style={s.riderFieldLabel}>Date</Text>
            <View style={s.riderFieldRow}>
              <TextInput style={s.riderField} value={riderDate} onChangeText={setRiderDate}
                placeholder="e.g. 14 June 2025" placeholderTextColor={C.textMuted} />
            </View>
            <Text style={s.riderFieldLabel}>Venue</Text>
            <View style={s.riderFieldRow}>
              <TextInput style={s.riderField} value={riderVenue} onChangeText={setRiderVenue}
                placeholder="e.g. Fabric, London" placeholderTextColor={C.textMuted} />
            </View>
            <TouchableOpacity
              style={[s.riderBtn, { marginTop: 20 }]}
              onPress={generateRider}
              disabled={riderLoading}
            >
              {riderLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="share-outline" size={16} color="#fff" />
                    <Text style={s.riderBtnText}>Generate &amp; Share PDF</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GearPickerModal
        visible={picker.visible}
        categories={picker.categories}
        title={picker.title}
        onSelect={picker.onSelect}
        onClose={() => setPicker(p => ({ ...p, visible: false }))}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  toggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 20, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: C.raised },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  section: { marginBottom: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: C.textSec, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.accentDim + '33', borderRadius: 6, borderWidth: 1, borderColor: C.accentDim },
  addBtnText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  addSlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addSlotText: { color: C.textSec, fontSize: 14 },
  chip: { backgroundColor: C.raised, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  chipBrand: { fontSize: 10, color: C.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6 },
  chipModel: { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 1 },
  chipMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  connBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', backgroundColor: C.accentDim + '30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  connBadgeText: { fontSize: 11, color: C.accent, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  connMenu: { backgroundColor: C.raised, borderRadius: 14, padding: 8, width: 260, borderWidth: 1, borderColor: C.border },
  connMenuTitle: { fontSize: 11, fontWeight: '600', color: C.textMuted, paddingHorizontal: 12, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  connOpt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8 },
  connOptActive: { backgroundColor: C.accentDim + '40' },
  connOptText: { fontSize: 14, color: C.text },
  gigPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  gigPillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  gigPillText: { fontSize: 13, fontWeight: '600', color: C.textSec },
  gigPillNew: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accentDim },
  warnCard: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 8 },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  warnLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  warnMsg: { fontSize: 13, color: C.text, lineHeight: 19, marginBottom: 7 },
  warnFixRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
  warnFix: { fontSize: 12, color: C.success, lineHeight: 17, flex: 1 },
  powerMeter: { backgroundColor: C.raised, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  powerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  powerLabel: { fontSize: 13, color: C.textSec },
  powerValue: { fontSize: 16, fontWeight: '700' },
  meterTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  powerHint: { fontSize: 11, color: C.textMuted, marginTop: 6 },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 21 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '30' },
  createBtnText: { fontSize: 14, color: C.accent, fontWeight: '600' },
  deleteGigBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'center', padding: 10 },
  deleteGigText: { fontSize: 13, color: C.critical },
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: C.border },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: C.raised, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  gearRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  gearRowCat: { fontSize: 10, fontWeight: '600', color: C.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  gearRowName: { fontSize: 15, fontWeight: '600', color: C.text },
  gearRowMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  sep: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  riderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginBottom: 16 },
  riderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  riderModal: { backgroundColor: C.surface, borderRadius: 16, padding: 20, margin: 24, borderWidth: 1, borderColor: C.border },
  riderFieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  riderFieldRow: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, justifyContent: 'center', marginBottom: 14 },
  riderField: { fontSize: 14, color: C.text },
});
