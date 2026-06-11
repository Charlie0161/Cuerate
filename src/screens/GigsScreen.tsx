import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import ApplyForGigModal, { BookingRequest } from './ApplyForGigModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

function formatFee(min: number | null, max: number | null) {
  if (!min && !max) return 'Fee TBC';
  const fmt = (p: number) => `£${(p / 100).toFixed(0)}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export default function GigsScreen() {
  const { user } = useAuthStore();
  const [gigs, setGigs] = useState<BookingRequest[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyTarget, setApplyTarget] = useState<BookingRequest | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setGigs((data as BookingRequest[]) ?? []);

    if (user && data && data.length > 0) {
      const ids = data.map((g: any) => g.id);
      const { data: apps } = await supabase
        .from('booking_applications')
        .select('request_id')
        .eq('dj_id', user.id)
        .in('request_id', ids);
      setAppliedIds(new Set((apps ?? []).map((a: any) => a.request_id)));
    }
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function renderGig({ item }: { item: BookingRequest }) {
    const applied = appliedIds.has(item.id);
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => !applied && setApplyTarget(item)}
        activeOpacity={applied ? 1 : 0.7}
      >
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.venueName}>{item.venue_name}</Text>
            <View style={s.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={C.textMuted} />
              <Text style={s.metaText}>{item.date}</Text>
            </View>
          </View>
          <Text style={s.fee}>{formatFee(item.fee_min, item.fee_max)}</Text>
        </View>

        <View style={s.cardBottom}>
          {item.genre ? (
            <View style={s.genrePill}>
              <Text style={s.genrePillText}>{item.genre}</Text>
            </View>
          ) : (
            <View style={[s.genrePill, { borderColor: C.border }]}>
              <Text style={[s.genrePillText, { color: C.textMuted }]}>Any genre</Text>
            </View>
          )}

          {item.description ? (
            <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {applied ? (
            <View style={s.appliedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={C.success} />
              <Text style={s.appliedText}>Applied</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.applyBtn} onPress={() => setApplyTarget(item)}>
              <Ionicons name="paper-plane-outline" size={13} color="#fff" />
              <Text style={s.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="megaphone-outline" size={40} color={C.textMuted} />
            <Text style={s.emptyTitle}>No open gigs yet</Text>
            <Text style={s.emptySub}>Venues will post gig slots here. Pull down to refresh.</Text>
          </View>
        }
      />

      {applyTarget && (
        <ApplyForGigModal
          request={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSuccess={() => {
            setAppliedIds(prev => new Set([...prev, applyTarget.id]));
            setApplyTarget(null);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  venueName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: C.textMuted },
  fee: { fontSize: 15, fontWeight: '700', color: C.accent },
  cardBottom: { gap: 10 },
  genrePill: { alignSelf: 'flex-start', backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  genrePillText: { fontSize: 11, fontWeight: '600', color: C.accent },
  desc: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: C.success + '15', borderWidth: 1, borderColor: C.success + '50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  appliedText: { fontSize: 13, fontWeight: '600', color: C.success },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10 },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
});
