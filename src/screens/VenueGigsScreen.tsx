import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import PostGigModal from './PostGigModal';
import GigApplicationsModal from './GigApplicationsModal';
import type { BookingRequest } from './ApplyForGigModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface GigWithCount extends BookingRequest {
  application_count: number;
}

function formatFee(min: number | null, max: number | null) {
  if (!min && !max) return 'Fee TBC';
  const fmt = (p: number) => `£${(p / 100).toFixed(0)}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export default function VenueGigsScreen() {
  const { user } = useAuthStore();
  const [gigs, setGigs] = useState<GigWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [selectedGig, setSelectedGig] = useState<BookingRequest | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('venue_id', user.id)
      .order('created_at', { ascending: false });

    if (!data) { setGigs([]); return; }

    // Fetch application counts
    const ids = data.map((g: any) => g.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: appData } = await supabase
        .from('booking_applications')
        .select('request_id')
        .in('request_id', ids);
      (appData ?? []).forEach((a: any) => {
        counts[a.request_id] = (counts[a.request_id] ?? 0) + 1;
      });
    }

    setGigs(data.map((g: any) => ({ ...g, application_count: counts[g.id] ?? 0 })));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function cancelGig(gig: GigWithCount) {
    Alert.alert(
      'Cancel gig?',
      'This will remove the listing and notify applicants it\'s been cancelled.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel gig', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('booking_requests')
              .update({ status: 'cancelled' })
              .eq('id', gig.id)
              .eq('venue_id', user!.id);
            if (error) { Alert.alert('Error', error.message); return; }
            setGigs(prev => prev.map(g => g.id === gig.id ? { ...g, status: 'cancelled' } : g));
          },
        },
      ]
    );
  }

  function renderGig({ item }: { item: GigWithCount }) {
    const statusColor = item.status === 'open' ? C.success : item.status === 'filled' ? C.accent : C.textMuted;
    const statusLabel = item.status === 'open' ? 'Open' : item.status === 'filled' ? 'Filled' : 'Cancelled';

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.venueName}>{item.venue_name}</Text>
            <View style={s.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={C.textMuted} />
              <Text style={s.metaText}>{item.date}</Text>
              {item.location ? (
                <>
                  <Text style={s.metaDot}>·</Text>
                  <Ionicons name="location-outline" size={12} color={C.textMuted} />
                  <Text style={s.metaText}>{item.location}</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={[s.statusBadge, { borderColor: statusColor + '50', backgroundColor: statusColor + '15' }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={s.cardMeta}>
          {item.genre ? (
            <View style={s.genrePill}>
              <Text style={s.genrePillText}>{item.genre}</Text>
            </View>
          ) : null}
          <Text style={s.fee}>{formatFee(item.fee_min, item.fee_max)}</Text>
        </View>

        {item.description ? (
          <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={s.cardActions}>
          {item.status === 'open' && (
            <TouchableOpacity
              style={s.appsBtn}
              onPress={() => setSelectedGig(item)}
            >
              <Ionicons name="people-outline" size={14} color={C.accent} />
              <Text style={s.appsBtnText}>
                {item.application_count} application{item.application_count !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
          {item.status === 'filled' && (
            <TouchableOpacity style={s.appsBtn} onPress={() => setSelectedGig(item)}>
              <Ionicons name="checkmark-circle" size={14} color={C.success} />
              <Text style={[s.appsBtnText, { color: C.success }]}>Filled · view applications</Text>
            </TouchableOpacity>
          )}
          {item.status === 'open' && (
            <TouchableOpacity style={s.cancelBtn} onPress={() => cancelGig(item)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={gigs}
        keyExtractor={g => g.id}
        renderItem={renderGig}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="megaphone-outline" size={40} color={C.textMuted} />
            <Text style={s.emptyTitle}>No gigs posted yet</Text>
            <Text style={s.emptySub}>Post a gig slot and DJs will apply.</Text>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowPost(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {showPost && (
        <PostGigModal
          onClose={() => setShowPost(false)}
          onSuccess={() => {
            setShowPost(false);
            load();
          }}
        />
      )}

      {selectedGig && (
        <GigApplicationsModal
          request={selectedGig}
          onClose={() => setSelectedGig(null)}
          onFilled={() => {
            setSelectedGig(null);
            load();
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  venueName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: C.textMuted },
  metaDot: { fontSize: 12, color: C.textMuted },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genrePill: { backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  genrePillText: { fontSize: 11, fontWeight: '600', color: C.accent },
  fee: { fontSize: 14, fontWeight: '700', color: C.accent },
  desc: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  appsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  appsBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.critical + '50', borderRadius: 8 },
  cancelBtnText: { fontSize: 13, color: C.critical, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
});
