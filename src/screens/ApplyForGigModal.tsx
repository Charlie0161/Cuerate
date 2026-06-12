import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { sendPushNotification } from '../lib/notifications';
import { containsProfanity } from '../lib/profanity';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

export interface BookingRequest {
  id: string;
  venue_id: string;
  venue_name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  genre: string | null;
  fee_min: number | null;
  fee_max: number | null;
  description: string | null;
  status: string;
  created_at: string;
}

function formatFee(min: number | null, max: number | null): string {
  if (!min && !max) return 'Fee TBC';
  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

interface Props {
  request: BookingRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApplyForGigModal({ request, onClose, onSuccess }: Props) {
  const { user, profile } = useAuthStore();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (!user) return;
    if (!message.trim()) { Alert.alert('Message required', 'Tell the venue a bit about yourself.'); return; }
    if (containsProfanity(message)) { Alert.alert('Hold on', 'Your message contains language that isn\'t allowed. Please keep it professional.'); return; }
    setLoading(true);
    const { error } = await supabase.from('booking_applications').insert({
      request_id: request.id,
      dj_id:      user.id,
      message:    message.trim(),
    });
    setLoading(false);
    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already applied', 'You have already applied for this gig.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    // Notify the venue owner — fire and forget
    const djName = profile?.dj_name ?? 'A DJ';
    sendPushNotification(
      request.venue_id,
      `New application for ${request.venue_name}`,
      `${djName} applied for your ${request.date} gig.`,
      { type: 'application_received', screen: 'gigs', requestId: request.id },
    );

    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Apply for gig</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {/* Gig summary card */}
          <View style={s.gigCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.gigVenue}>{request.venue_name}</Text>
                <Text style={s.gigDate}>{request.date}</Text>
              </View>
              <Text style={s.gigFee}>{formatFee(request.fee_min, request.fee_max)}</Text>
            </View>
            {request.genre && (
              <View style={s.genreBadge}>
                <Text style={s.genreBadgeText}>{request.genre}</Text>
              </View>
            )}
            {request.description && (
              <Text style={s.gigDesc}>{request.description}</Text>
            )}
          </View>

          {/* DJ info note */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={14} color={C.accent} />
            <Text style={s.infoText}>
              Your profile (name, genre, SoundCloud) is shared with the venue. They'll contact you via your booking email
              {profile?.booking_email ? ` (${profile.booking_email})` : ' — set one in your profile'}.
            </Text>
          </View>

          {/* Message */}
          <Text style={s.label}>Your message *</Text>
          <TextInput
            style={[s.input, { height: 120, textAlignVertical: 'top', paddingTop: 12 }]}
            value={message} onChangeText={setMessage}
            placeholder="Introduce yourself. Include your experience, mix links, or anything relevant…"
            placeholderTextColor={C.textMuted}
            multiline
            autoFocus
          />

          <TouchableOpacity
            style={[s.applyBtn, loading && { opacity: 0.6 }]}
            onPress={handleApply} disabled={loading}
          >
            <Ionicons name="paper-plane-outline" size={16} color="#fff" />
            <Text style={s.applyBtnText}>{loading ? 'Sending…' : 'Send application'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  gigCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8 },
  gigVenue: { fontSize: 16, fontWeight: '700', color: C.text },
  gigDate: { fontSize: 13, color: C.textSec, marginTop: 2 },
  gigFee: { fontSize: 15, fontWeight: '700', color: C.accent },
  genreBadge: { alignSelf: 'flex-start', backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  genreBadgeText: { fontSize: 11, fontWeight: '600', color: C.accent },
  gigDesc: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: C.accentDim + '20', borderRadius: 10, borderWidth: 1, borderColor: C.accentDim + '40', padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: C.textSec, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '600', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 14, color: C.text },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 15 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
