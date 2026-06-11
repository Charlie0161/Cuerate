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
  success: '#4DCC8F', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const GENRES = ['Any', 'House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other'];

interface Props {
  venueName: string;
  venueId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostBookingRequestModal({ venueName, venueId, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [date, setDate]             = useState('');
  const [genre, setGenre]           = useState('Any');
  const [feeMin, setFeeMin]         = useState('');
  const [feeMax, setFeeMax]         = useState('');
  const [description, setDesc]      = useState('');
  const [loading, setLoading]       = useState(false);

  async function handlePost() {
    if (!date.trim()) { Alert.alert('Date required', 'Please enter the gig date.'); return; }
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('booking_requests').insert({
      venue_id:    venueId,
      venue_name:  venueName,
      date:        date.trim(),
      genre:       genre === 'Any' ? null : genre,
      fee_min:     feeMin ? Math.round(parseFloat(feeMin) * 100) : null,
      fee_max:     feeMax ? Math.round(parseFloat(feeMax) * 100) : null,
      description: description.trim() || null,
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Post a gig slot</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={s.venuePill}>
            <Ionicons name="business-outline" size={14} color={C.accent} />
            <Text style={s.venuePillText}>{venueName}</Text>
          </View>

          <Text style={s.label}>Date *</Text>
          <TextInput
            style={s.input}
            value={date} onChangeText={setDate}
            placeholder="e.g. 2026-08-15 or Fri 15 Aug"
            placeholderTextColor={C.textMuted}
          />

          <Text style={s.label}>Genre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENRES.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.genrePill, genre === g && s.genrePillActive]}
                  onPress={() => setGenre(g)}
                >
                  <Text style={[s.genrePillText, genre === g && s.genrePillTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.label}>Fee range (£)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={[s.inputRow, { flex: 1 }]}>
              <Text style={s.currencyPrefix}>£</Text>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                value={feeMin} onChangeText={setFeeMin}
                placeholder="Min" placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={[s.inputRow, { flex: 1 }]}>
              <Text style={s.currencyPrefix}>£</Text>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                value={feeMax} onChangeText={setFeeMax}
                placeholder="Max" placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
            value={description} onChangeText={setDesc}
            placeholder="Set length, expected crowd, vibe, anything DJs should know…"
            placeholderTextColor={C.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[s.postBtn, loading && { opacity: 0.6 }]}
            onPress={handlePost} disabled={loading}
          >
            <Ionicons name="megaphone-outline" size={16} color="#fff" />
            <Text style={s.postBtnText}>{loading ? 'Posting…' : 'Post gig slot'}</Text>
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
  venuePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 20 },
  venuePillText: { fontSize: 13, fontWeight: '600', color: C.accent },
  label: { fontSize: 12, fontWeight: '600', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, marginBottom: 16 },
  currencyPrefix: { fontSize: 16, color: C.textMuted, marginRight: 4 },
  genrePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  genrePillActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  genrePillText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  genrePillTextActive: { color: C.accent },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  postBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
