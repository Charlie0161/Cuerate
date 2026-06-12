import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: 'laptop', label: 'Laptop + charger', category: 'Gear', checked: false },
  { id: 'usb1', label: 'USB drive 1 (main)', category: 'Gear', checked: false },
  { id: 'usb2', label: 'USB drive 2 (backup)', category: 'Gear', checked: false },
  { id: 'headphones', label: 'Headphones', category: 'Gear', checked: false },
  { id: 'controller', label: 'Controller / mixer', category: 'Gear', checked: false },
  { id: 'power', label: 'Power strip / extension', category: 'Cables', checked: false },
  { id: 'xlr', label: 'XLR cables (x2)', category: 'Cables', checked: false },
  { id: 'rca', label: 'RCA cables', category: 'Cables', checked: false },
  { id: 'jack35', label: '3.5mm → RCA adapter', category: 'Cables', checked: false },
  { id: 'usbc', label: 'USB-C hub / dongle', category: 'Cables', checked: false },
  { id: 'id', label: 'ID / Guest list confirmation', category: 'Admin', checked: false },
  { id: 'contract', label: 'Contract / fee agreed', category: 'Admin', checked: false },
  { id: 'contact', label: "Promoter's number saved", category: 'Admin', checked: false },
  { id: 'earplugs', label: 'Ear plugs', category: 'Personal', checked: false },
  { id: 'water', label: 'Water bottle', category: 'Personal', checked: false },
];

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  checked: boolean;
  custom?: boolean;
}

interface Gig {
  id: string;
  venue_name: string;
  date: string;
  start_time: string | null;
}

const STORAGE_KEY = (gigId: string) => `checklist_${gigId}`;
const CATEGORIES = ['Gear', 'Cables', 'Admin', 'Personal'];

export default function GigChecklistScreen() {
  const { user } = useAuthStore();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loadingGigs, setLoadingGigs] = useState(true);

  const loadGigs = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('dj_gigs')
      .select('id, venue_name, date, start_time')
      .eq('dj_id', user.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(10);
    setGigs((data as Gig[]) ?? []);
    setLoadingGigs(false);
  }, [user]);

  useEffect(() => { loadGigs(); }, [loadGigs]);

  async function selectGig(gig: Gig) {
    setSelectedGig(gig);
    const raw = await AsyncStorage.getItem(STORAGE_KEY(gig.id));
    if (raw) {
      setItems(JSON.parse(raw));
    } else {
      const fresh = DEFAULT_ITEMS.map(i => ({ ...i, checked: false }));
      setItems(fresh);
      await AsyncStorage.setItem(STORAGE_KEY(gig.id), JSON.stringify(fresh));
    }
  }

  async function toggle(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    setItems(updated);
    if (selectedGig) await AsyncStorage.setItem(STORAGE_KEY(selectedGig.id), JSON.stringify(updated));
  }

  async function addCustom() {
    if (!newLabel.trim()) return;
    const item: ChecklistItem = {
      id: `custom_${Date.now()}`, label: newLabel.trim(),
      category: 'Personal', checked: false, custom: true,
    };
    const updated = [...items, item];
    setItems(updated);
    setNewLabel('');
    if (selectedGig) await AsyncStorage.setItem(STORAGE_KEY(selectedGig.id), JSON.stringify(updated));
  }

  async function removeCustom(id: string) {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    if (selectedGig) await AsyncStorage.setItem(STORAGE_KEY(selectedGig.id), JSON.stringify(updated));
  }

  async function resetChecklist() {
    Alert.alert('Reset checklist', 'Uncheck all items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          const updated = items.map(i => ({ ...i, checked: false }));
          setItems(updated);
          if (selectedGig) await AsyncStorage.setItem(STORAGE_KEY(selectedGig.id), JSON.stringify(updated));
        },
      },
    ]);
  }

  const checked = items.filter(i => i.checked).length;
  const total = items.length;
  const allDone = checked === total && total > 0;

  if (loadingGigs) {
    return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
  }

  // Gig picker
  if (!selectedGig) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
        <Text style={s.heading}>Pick a gig to check off</Text>
        {gigs.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={40} color={C.textMuted} />
            <Text style={s.emptyTitle}>No upcoming gigs</Text>
            <Text style={s.emptySub}>Add gigs in the Calendar tab first.</Text>
          </View>
        ) : (
          gigs.map(g => (
            <TouchableOpacity key={g.id} style={s.gigCard} onPress={() => selectGig(g)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={s.gigVenue}>{g.venue_name}</Text>
                <Text style={s.gigDate}>{new Date(g.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{g.start_time ? ` · ${g.start_time}` : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSelectedGig(null)} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerVenue} numberOfLines={1}>{selectedGig.venue_name}</Text>
          <Text style={s.headerDate}>{new Date(selectedGig.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={resetChecklist} hitSlop={8}>
          <Ionicons name="refresh-outline" size={20} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${total ? (checked / total) * 100 : 0}%` as any, backgroundColor: allDone ? C.success : C.accent }]} />
        </View>
        <Text style={[s.progressLabel, { color: allDone ? C.success : C.textMuted }]}>
          {allDone ? '✓ All packed!' : `${checked} / ${total}`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {CATEGORIES.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <View key={cat} style={{ marginBottom: 20 }}>
              <Text style={s.catLabel}>{cat}</Text>
              {catItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.itemRow, item.checked && s.itemRowDone]}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[s.checkbox, item.checked && s.checkboxDone]}>
                    {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[s.itemLabel, item.checked && s.itemLabelDone]}>{item.label}</Text>
                  {item.custom && (
                    <TouchableOpacity onPress={() => removeCustom(item.id)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* Add custom item */}
        <View style={s.addRow}>
          <TextInput
            style={s.addInput}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="Add custom item…"
            placeholderTextColor={C.textMuted}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
          <TouchableOpacity style={[s.addBtn, !newLabel.trim() && { opacity: 0.4 }]} onPress={addCustom} disabled={!newLabel.trim()}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 20 },
  gigCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 10 },
  gigVenue: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  gigDate: { fontSize: 13, color: C.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  headerVenue: { fontSize: 16, fontWeight: '700', color: C.text },
  headerDate: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  progressTrack: { flex: 1, height: 6, backgroundColor: C.raised, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 13, fontWeight: '700', width: 70, textAlign: 'right' },
  catLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 6 },
  itemRowDone: { opacity: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: C.success, borderColor: C.success },
  itemLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  itemLabelDone: { textDecorationLine: 'line-through', color: C.textMuted },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  addInput: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  addBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
