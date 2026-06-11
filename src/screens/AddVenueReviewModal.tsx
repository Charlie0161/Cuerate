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
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  gold: '#F0C040', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface AddVenueReviewModalProps {
  venue: Venue;
  onClose: () => void;
  onSuccess: () => void;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={n <= value ? C.gold : C.textMuted}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const RATING_LABELS: Record<string, string[]> = {
  pay:   ['Unpaid / very low', 'Below market', 'Fair', 'Good pay', 'Excellent pay'],
  gear:  ['Very poor kit', 'Below average', 'Adequate', 'Good gear', 'Industry standard'],
  booth: ['Cramped / difficult', 'Below average', 'Functional', 'Well set up', 'Perfect setup'],
  vibe:  ['Poor crowd / vibe', 'Quiet / flat', 'OK atmosphere', 'Great crowd', 'Incredible vibe'],
};

export default function AddVenueReviewModal({ venue, onClose, onSuccess }: AddVenueReviewModalProps) {
  const { user } = useAuthStore();
  const [payRating,   setPayRating]   = useState(0);
  const [gearRating,  setGearRating]  = useState(0);
  const [boothRating, setBoothRating] = useState(0);
  const [vibeRating,  setVibeRating]  = useState(0);
  const [reviewText,  setReviewText]  = useState('');
  const [playedDate,  setPlayedDate]  = useState('');
  const [loading, setLoading]         = useState(false);

  const allRated = payRating > 0 && gearRating > 0 && boothRating > 0 && vibeRating > 0;

  async function handleSubmit() {
    if (!allRated) { Alert.alert('Rate all categories', 'Please rate all four categories before submitting.'); return; }
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('venue_reviews').insert({
        venue_id:    venue.id,
        reviewer_id: user.id,
        rating_pay:   payRating,
        rating_gear:  gearRating,
        rating_booth: boothRating,
        rating_vibe:  vibeRating,
        review_text:  reviewText.trim() || null,
        played_date:  playedDate.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      if (e.code === '23505') {
        Alert.alert('Already reviewed', 'You\'ve already submitted a review for this venue.');
      } else {
        Alert.alert('Error', e.message ?? 'Could not submit review.');
      }
    } finally {
      setLoading(false);
    }
  }

  const categories = [
    { key: 'pay',   label: 'Pay reliability', value: payRating,   onChange: setPayRating },
    { key: 'gear',  label: 'Gear quality',    value: gearRating,  onChange: setGearRating },
    { key: 'booth', label: 'Booth setup',     value: boothRating, onChange: setBoothRating },
    { key: 'vibe',  label: 'Vibe / crowd',    value: vibeRating,  onChange: setVibeRating },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={r.header}>
          <View>
            <Text style={r.title}>Review {venue.name}</Text>
            <Text style={r.sub}>{venue.city} · Honour system — be honest</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Rating categories */}
          {categories.map(cat => (
            <View key={cat.key} style={r.categoryCard}>
              <Text style={r.categoryLabel}>{cat.label}</Text>
              <StarPicker value={cat.value} onChange={cat.onChange} />
              {cat.value > 0 && (
                <Text style={r.ratingHint}>
                  {RATING_LABELS[cat.key][cat.value - 1]}
                </Text>
              )}
            </View>
          ))}

          {/* When did you play */}
          <View style={r.fieldWrap}>
            <Text style={r.fieldLabel}>When did you play here? <Text style={{ color: C.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
            <TextInput
              style={r.field} value={playedDate} onChangeText={setPlayedDate}
              placeholder="e.g. March 2024, New Year's 2023"
              placeholderTextColor={C.textMuted}
            />
          </View>

          {/* Written review */}
          <View style={r.fieldWrap}>
            <Text style={r.fieldLabel}>Review <Text style={{ color: C.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
            <TextInput
              style={[r.field, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
              value={reviewText} onChangeText={setReviewText}
              placeholder="Tell other DJs what to expect — sound system, organisation, hospitality..."
              placeholderTextColor={C.textMuted}
              multiline
            />
          </View>

          {/* Disclaimer */}
          <View style={r.disclaimer}>
            <Ionicons name="shield-checkmark-outline" size={14} color={C.textMuted} />
            <Text style={r.disclaimerText}>
              Reviews are anonymous to venues. One review per DJ per venue. Be honest and constructive.
            </Text>
          </View>

          <TouchableOpacity
            style={[r.submitBtn, (!allRated || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!allRated || loading}
          >
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={r.submitBtnText}>{loading ? 'Submitting…' : 'Submit review'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const r = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  categoryCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 10 },
  ratingHint: { fontSize: 12, color: C.textMuted, marginTop: 6, fontStyle: 'italic' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.raised, borderRadius: 8, padding: 12, marginBottom: 16 },
  disclaimerText: { fontSize: 12, color: C.textMuted, flex: 1, lineHeight: 17 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
