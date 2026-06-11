import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Venue } from './VenueDirectoryScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const ROLES = ['Owner', 'Manager', 'Booker', 'Promoter', 'Other'];

interface Props {
  venue: Venue;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VenueClaimModal({ venue, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [name, setName]       = useState('');
  const [role, setRole]       = useState('');
  const [proofUrl, setProof]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !role) {
      Alert.alert('Required', 'Please enter your name and role.');
      return;
    }
    setLoading(true);
    try {
      // Check for existing pending claim
      const { data: existing } = await supabase
        .from('venue_claims')
        .select('id')
        .eq('venue_id', venue.id)
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        Alert.alert('Already submitted', 'You already have a pending claim for this venue.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('venue_claims').insert({
        venue_id:  venue.id,
        user_id:   user!.id,
        name:      name.trim(),
        role,
        proof_url: proofUrl.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not submit claim.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Claim venue</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Venue name */}
          <View style={s.venueChip}>
            <Ionicons name="business-outline" size={16} color={C.accent} />
            <Text style={s.venueChipText}>{venue.name}</Text>
          </View>

          <Text style={s.info}>
            Tell us who you are and how you're connected to this venue. A Cuerate admin will review your request within 48 hours.
          </Text>

          {/* Your name */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Your name *</Text>
            <TextInput
              style={s.field}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Role */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Your role at {venue.name} *</Text>
            <View style={s.roleGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.rolePill, role === r && s.rolePillActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[s.rolePillText, role === r && s.rolePillTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Proof */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Proof (optional but recommended)</Text>
            <Text style={s.fieldHint}>Instagram, website, LinkedIn — anything that links you to this venue</Text>
            <TextInput
              style={s.field}
              value={proofUrl}
              onChangeText={setProof}
              placeholder="https://instagram.com/yourvenue"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Ionicons name="flag-outline" size={18} color="#fff" />
            <Text style={s.submitBtnText}>{loading ? 'Submitting…' : 'Submit claim'}</Text>
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
  venueChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  venueChipText: { fontSize: 15, fontWeight: '700', color: C.accent },
  info: { fontSize: 13, color: C.textSec, lineHeight: 20, marginBottom: 24 },
  fieldWrap: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6 },
  fieldHint: { fontSize: 11, color: C.textMuted, marginBottom: 8 },
  field: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rolePill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  rolePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  rolePillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  rolePillTextActive: { color: C.accent },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
