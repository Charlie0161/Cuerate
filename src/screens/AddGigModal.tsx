import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Props {
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSuccess: (date: string) => void;
}

export default function AddGigModal({ initialDate, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [venueName, setVenueName] = useState('');
  const [date, setDate] = useState(initialDate ?? '');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!venueName.trim()) { Alert.alert('Venue name required'); return; }
    if (!date.trim()) { Alert.alert('Date required'); return; }
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('dj_gigs').insert({
      dj_id: user.id,
      venue_name: venueName.trim(),
      date: date.trim(),
      start_time: startTime.trim() || null,
      location: location.trim() || null,
      fee: fee ? Math.round(parseFloat(fee) * 100) : null,
      notes: notes.trim() || null,
      source: 'manual',
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onSuccess(date.trim());
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Add gig</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Venue *</Text>
          <TextInput style={s.input} value={venueName} onChangeText={setVenueName}
            placeholder="e.g. Fabric, London" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Date *</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Start time <Text style={s.optional}>(optional)</Text></Text>
          <TextInput style={s.input} value={startTime} onChangeText={setStartTime}
            placeholder="e.g. 23:00" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Location <Text style={s.optional}>(optional)</Text></Text>
          <TextInput style={s.input} value={location} onChangeText={setLocation}
            placeholder="e.g. London, UK" placeholderTextColor={C.textMuted} />

          <Text style={s.label}>Fee <Text style={s.optional}>(optional)</Text></Text>
          <View style={s.feeRow}>
            <Text style={s.currencyPrefix}>£</Text>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
              value={fee} onChangeText={setFee}
              placeholder="0.00" placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
          </View>
          <View style={{ height: 16 }} />

          <Text style={s.label}>Notes <Text style={s.optional}>(optional)</Text></Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
            value={notes} onChangeText={setNotes}
            placeholder="Set length, gear needed, contacts…"
            placeholderTextColor={C.textMuted} multiline />

          <TouchableOpacity
            style={[s.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave} disabled={loading}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={s.saveBtnText}>{loading ? 'Saving…' : 'Add to calendar'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  label: { fontSize: 12, fontWeight: '600', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontSize: 11, fontWeight: '400', color: C.textMuted, textTransform: 'none' },
  input: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 16 },
  feeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46 },
  currencyPrefix: { fontSize: 16, color: C.textMuted, marginRight: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
