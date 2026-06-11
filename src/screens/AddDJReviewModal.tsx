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
  success: '#4DCC8F', gold: '#F0C040',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Props {
  djId: string;
  djName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { key: 'rating_professionalism', label: 'Professionalism', icon: 'shield-checkmark-outline' },
  { key: 'rating_communication',   label: 'Communication',   icon: 'chatbubble-outline' },
  { key: 'rating_music',           label: 'Music quality',   icon: 'musical-notes-outline' },
  { key: 'rating_punctuality',     label: 'Punctuality',     icon: 'time-outline' },
] as const;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={n <= value ? C.gold : C.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function AddDJReviewModal({ djId, djName, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [ratings, setRatings] = useState<Record<string, number>>({
    rating_professionalism: 0,
    rating_communication: 0,
    rating_music: 0,
    rating_punctuality: 0,
  });
  const [reviewText, setReviewText] = useState('');
  const [gigDate, setGigDate]       = useState('');
  const [loading, setLoading]       = useState(false);

  function setRating(key: string, value: number) {
    setRatings(prev => ({ ...prev, [key]: value }));
  }

  const allRated = Object.values(ratings).every(v => v > 0);

  async function handleSubmit() {
    if (!allRated) {
      Alert.alert('Rate all categories', 'Please give a star rating for each category.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('dj_reviews').insert({
        dj_id:       djId,
        reviewer_id: user!.id,
        ...ratings,
        review_text: reviewText.trim() || null,
        gig_date:    gigDate.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      if (e.code === '23505') {
        Alert.alert('Already reviewed', 'You have already submitted a review for this DJ.');
      } else {
        Alert.alert('Error', e.message ?? 'Could not submit review.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Review {djName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>
            Only visible to other venue owners. Rate based on your experience booking this DJ.
          </Text>

          {/* Star ratings */}
          {CATEGORIES.map(cat => (
            <View key={cat.key} style={s.categoryRow}>
              <View style={s.categoryLabel}>
                <Ionicons name={cat.icon as any} size={15} color={C.textSec} />
                <Text style={s.categoryText}>{cat.label}</Text>
              </View>
              <StarPicker
                value={ratings[cat.key]}
                onChange={v => setRating(cat.key, v)}
              />
            </View>
          ))}

          {/* Gig date */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>When did they play? (optional)</Text>
            <TextInput
              style={s.field}
              value={gigDate}
              onChangeText={setGigDate}
              placeholder="e.g. March 2025"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Written review */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Written review (optional)</Text>
            <TextInput
              style={[s.field, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience with this DJ..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={500}
            />
            <Text style={s.charCount}>{reviewText.length}/500</Text>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, (!allRated || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!allRated || loading}
          >
            <Ionicons name="star-outline" size={18} color="#fff" />
            <Text style={s.submitBtnText}>{loading ? 'Submitting…' : 'Submit review'}</Text>
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
  intro: { fontSize: 13, color: C.textSec, lineHeight: 20, marginBottom: 24 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  categoryLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryText: { fontSize: 14, fontWeight: '600', color: C.text },
  fieldWrap: { marginTop: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 8 },
  field: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text },
  charCount: { fontSize: 11, color: C.textMuted, textAlign: 'right', marginTop: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginTop: 28 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
