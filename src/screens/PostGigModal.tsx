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

const GENRES = ['House', 'Techno', 'Drum & Bass', 'Garage', 'Hip-Hop', 'R&B', 'Afrobeats', 'Pop', 'Open Format'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostGigModal({ onClose, onSuccess }: Props) {
  const { user, profile } = useAuthStore();
  const [venueName, setVenueName] = useState(profile?.dj_name ?? '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [genre, setGenre] = useState('');
  const [feeMin, setFeeMin] = useState('');
  const [feeMax, setFeeMax] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  function validateDate(d: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
  }

  async function handlePost() {
    if (!venueName.trim()) { Alert.alert('Venue name required'); return; }
    if (!date.trim() || !validateDate(date.trim())) {
      Alert.alert('Valid date required', 'Use YYYY-MM-DD format (e.g. 2025-08-15)');
      return;
    }
    if (!location.trim()) { Alert.alert('Location required'); return; }
    if (!user) return;

    const feeMinVal = feeMin ? Math.round(parseFloat(feeMin) * 100) : null;
    const feeMaxVal = feeMax ? Math.round(parseFloat(feeMax) * 100) : null;
    if (feeMinVal !== null && isNaN(feeMinVal)) { Alert.alert('Invalid min fee'); return; }
    if (feeMaxVal !== null && isNaN(feeMaxVal)) { Alert.alert('Invalid max fee'); return; }
    if (feeMinVal !== null && feeMaxVal !== null && feeMinVal > feeMaxVal) {
      Alert.alert('Min fee cannot exceed max fee'); return;
    }

    setLoading(true);
    const { error } = await supabase.from('booking_requests').insert({
      venue_id: user.id,
      venue_name: venueName.trim().slice(0, 100),
      date: date.trim(),
      start_time: startTime.trim().slice(0, 10) || null,
      location: location.trim().slice(0, 100),
      genre: genre || null,
      fee_min: feeMinVal,
      fee_max: feeMaxVal,
      description: description.trim().slice(0, 500) || null,
      status: 'open',
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Post a gig</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Venue / Event name *</Text>
          <TextInput style={s.input} value={venueName} onChangeText={setVenueName}
            placeholder="e.g. Fabric, London" placeholderTextColor={C.textMuted} maxLength={100} />

          <Text style={s.label}>Location *</Text>
          <TextInput style={s.input} value={location} onChangeText={setLocation}
            placeholder="e.g. London, UK" placeholderTextColor={C.textMuted} maxLength={100} />

          <Text style={s.label}>Date *</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />

          <Text style={s.label}>Start time <Text style={s.optional}>(optional)</Text></Text>
          <TextInput style={s.input} value={startTime} onChangeText={setStartTime}
            placeholder="e.g. 22:00" placeholderTextColor={C.textMuted} maxLength={10} />

          <Text style={s.label}>Genre <Text style={s.optional}>(optional)</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENRES.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.genrePill, genre === g && s.genrePillActive]}
                  onPress={() => setGenre(genre === g ? '' : g)}
                >
                  <Text style={[s.genrePillText, genre === g && s.genrePillTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.label}>Fee range <Text style={s.optional}>(optional)</Text></Text>
          <View style={s.feeRow}>
            <View style={[s.feeBox, { flex: 1 }]}>
              <Text style={s.currencyPrefix}>£</Text>
              <TextInput style={s.feeInput} value={feeMin} onChangeText={setFeeMin}
                placeholder="Min" placeholderTextColor={C.textMuted} keyboardType="numeric" />
            </View>
            <Text style={s.feeSep}>–</Text>
            <View style={[s.feeBox, { flex: 1 }]}>
              <Text style={s.currencyPrefix}>£</Text>
              <TextInput style={s.feeInput} value={feeMax} onChangeText={setFeeMax}
                placeholder="Max" placeholderTextColor={C.textMuted} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ height: 16 }} />

          <Text style={s.label}>Description <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
            value={description} onChangeText={setDescription}
            placeholder="Set length, vibe, what you're looking for in a DJ…"
            placeholderTextColor={C.textMuted} multiline maxLength={500}
          />

          <TouchableOpacity
            style={[s.postBtn, loading && { opacity: 0.6 }]}
            onPress={handlePost} disabled={loading}
          >
            <Ionicons name="megaphone-outline" size={16} color="#fff" />
            <Text style={s.postBtnText}>{loading ? 'Posting…' : 'Post gig'}</Text>
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
  genrePill: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  genrePillActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  genrePillText: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  genrePillTextActive: { color: C.accent },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 46 },
  currencyPrefix: { fontSize: 16, color: C.textMuted, marginRight: 4 },
  feeInput: { flex: 1, fontSize: 14, color: C.text },
  feeSep: { fontSize: 16, color: C.textMuted },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  postBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
