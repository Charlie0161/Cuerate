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
  success: '#4DCC8F', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const GENRES = ['House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitSetModal({ onClose, onSuccess }: Props) {
  const { profile, user } = useAuthStore();
  const [djName, setDjName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [stage, setStage] = useState('');
  const [genre, setGenre] = useState('');
  const [mixUrl, setMixUrl] = useState('');
  const [tracklistUrl, setTracklistUrl] = useState('');
  const [loading, setLoading] = useState(false);

  function fillMyName() {
    setDjName(profile?.dj_name ?? '');
  }

  async function handleSubmit() {
    if (!djName.trim()) { Alert.alert('DJ name required'); return; }
    if (!eventName.trim()) { Alert.alert('Event name required'); return; }
    if (!user) { Alert.alert('Sign in to submit sets'); return; }
    setLoading(true);

    // Check if DJ name matches a profile on the app
    const { data: matchedProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('dj_name', djName.trim())
      .maybeSingle();

    const { error } = await supabase.from('festival_sets').insert({
      dj_name: djName.trim(),
      dj_profile_id: matchedProfile?.id ?? null,
      event_name: eventName.trim(),
      event_date: eventDate.trim() || null,
      stage: stage.trim() || null,
      genre: genre || null,
      mix_url: mixUrl.trim() || null,
      tracklist_url: tracklistUrl.trim() || null,
      submitted_by: user.id,
    });

    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Submit a set</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

          {/* DJ Name */}
          <Text style={s.label}>DJ Name *</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={djName} onChangeText={setDjName}
              placeholder="e.g. Chris Stussy"
              placeholderTextColor={C.textMuted}
            />
            {profile?.dj_name && (
              <TouchableOpacity style={s.meBtn} onPress={fillMyName}>
                <Text style={s.meBtnText}>That's me</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Event */}
          <Text style={s.label}>Event / Festival *</Text>
          <TextInput
            style={s.input}
            value={eventName} onChangeText={setEventName}
            placeholder="e.g. Forbidden Forest"
            placeholderTextColor={C.textMuted}
          />

          {/* Date */}
          <Text style={s.label}>Date</Text>
          <TextInput
            style={s.input}
            value={eventDate} onChangeText={setEventDate}
            placeholder="e.g. 2025-06-14"
            placeholderTextColor={C.textMuted}
          />

          {/* Stage */}
          <Text style={s.label}>Stage <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.input}
            value={stage} onChangeText={setStage}
            placeholder="e.g. Main Stage"
            placeholderTextColor={C.textMuted}
          />

          {/* Genre */}
          <Text style={s.label}>Genre <Text style={s.optional}>(optional)</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENRES.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.pill, genre === g && s.pillActive]}
                  onPress={() => setGenre(genre === g ? '' : g)}
                >
                  <Text style={[s.pillText, genre === g && s.pillTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Mix URL */}
          <Text style={s.label}>Mix recording URL <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.input}
            value={mixUrl} onChangeText={setMixUrl}
            placeholder="SoundCloud, Mixcloud, YouTube…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />

          {/* Tracklist URL */}
          <Text style={s.label}>1001Tracklists URL <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.input}
            value={tracklistUrl} onChangeText={setTracklistUrl}
            placeholder="https://www.1001tracklists.com/…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={loading}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text style={s.submitBtnText}>{loading ? 'Submitting…' : 'Submit set'}</Text>
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  meBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim },
  meBtnText: { fontSize: 12, fontWeight: '600', color: C.accent },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  pillActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  pillText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  pillTextActive: { color: C.accent },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
