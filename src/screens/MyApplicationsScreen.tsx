import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Application {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  message: string;
  created_at: string;
  request: {
    id: string;
    venue_name: string;
    date: string;
    location: string | null;
    genre: string | null;
    fee_min: number | null;
    fee_max: number | null;
    status: string;
  };
}

function formatFee(min: number | null, max: number | null) {
  if (!min && !max) return 'Fee TBC';
  const fmt = (p: number) => `£${(p / 100).toFixed(0)}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: C.warning,  bg: '#1F1508', icon: 'time-outline' as const },
  accepted: { label: 'Accepted', color: C.success,  bg: '#071A0F', icon: 'checkmark-circle-outline' as const },
  declined: { label: 'Declined', color: C.critical, bg: '#1F0E0E', icon: 'close-circle-outline' as const },
};

export default function MyApplicationsScreen() {
  const { user, session } = useAuthStore();
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('booking_applications')
      .select(`
        id, status, message, created_at,
        request:request_id (id, venue_name, date, location, genre, fee_min, fee_max, status)
      `)
      .eq('dj_id', user.id)
      .order('created_at', { ascending: false });

    setApplications((data ?? []).map((a: any) => ({
      ...a,
      request: Array.isArray(a.request) ? a.request[0] : a.request,
    })) as Application[]);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!session) {
    return (
      <View style={s.center}>
        <Ionicons name="paper-plane-outline" size={40} color={C.textMuted} />
        <Text style={s.emptyTitle}>Sign in to see your applications</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>;
  }

  return (
    <FlatList
      data={applications}
      keyExtractor={a => a.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      ListEmptyComponent={
        <View style={s.center}>
          <Ionicons name="paper-plane-outline" size={40} color={C.textMuted} />
          <Text style={s.emptyTitle}>No applications yet</Text>
          <Text style={s.emptySub}>Browse the gig board and apply to gigs — your applications show up here.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const cfg = STATUS_CONFIG[item.status];
        const gigCancelled = item.request?.status === 'cancelled';
        return (
          <View style={[s.card, gigCancelled && s.cardFaded]}>
            {/* Status banner */}
            <View style={[s.statusBar, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
              <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
              {gigCancelled && <Text style={s.cancelledNote}> · Gig cancelled</Text>}
            </View>

            {/* Gig details */}
            <View style={s.cardBody}>
              <View style={{ flex: 1 }}>
                <Text style={s.venueName}>{item.request?.venue_name ?? '—'}</Text>
                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={C.textMuted} />
                  <Text style={s.metaText}>{item.request?.date ? formatDate(item.request.date) : '—'}</Text>
                </View>
                {item.request?.location && (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={12} color={C.textMuted} />
                    <Text style={s.metaText}>{item.request.location}</Text>
                  </View>
                )}
              </View>
              <Text style={s.fee}>{formatFee(item.request?.fee_min ?? null, item.request?.fee_max ?? null)}</Text>
            </View>

            {item.request?.genre && (
              <View style={s.genrePill}>
                <Text style={s.genrePillText}>{item.request.genre}</Text>
              </View>
            )}

            {/* Your message */}
            <View style={s.messageBox}>
              <Text style={s.messageLabel}>Your message</Text>
              <Text style={s.messageText} numberOfLines={3}>{item.message}</Text>
            </View>

            {/* Accepted nudge */}
            {item.status === 'accepted' && (
              <View style={s.acceptedNote}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} />
                <Text style={s.acceptedNoteText}>You got the gig! Check your booking email for next steps.</Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden' },
  cardFaded: { opacity: 0.6 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  statusLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cancelledNote: { fontSize: 11, color: C.textMuted },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10 },
  venueName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metaText: { fontSize: 12, color: C.textMuted },
  fee: { fontSize: 15, fontWeight: '700', color: C.accent },
  genrePill: { alignSelf: 'flex-start', marginHorizontal: 14, marginBottom: 10, backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  genrePillText: { fontSize: 11, fontWeight: '600', color: C.accent },
  messageBox: { marginHorizontal: 14, marginBottom: 12, backgroundColor: C.raised, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border },
  messageLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  messageText: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  acceptedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 14, marginBottom: 14, backgroundColor: C.success + '10', borderRadius: 8, borderWidth: 1, borderColor: C.success + '40', padding: 10 },
  acceptedNoteText: { fontSize: 12, color: C.success, fontWeight: '500', flex: 1 },
});
