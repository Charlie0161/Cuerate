import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', critical: '#FF4D4D', warning: '#F5A623', gold: '#F0C040',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Claim {
  id: string;
  venue_id: string;
  user_id: string;
  name: string;
  role: string;
  proof_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  venue_name?: string;
  venue_city?: string;
  dj_name?: string;
  email?: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  onClose: () => void;
}

export default function AdminScreen({ onClose }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    const { data: rawClaims } = await supabase
      .from('venue_claims')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (!rawClaims || rawClaims.length === 0) {
      setClaims([]);
      setLoading(false);
      return;
    }

    // Batch fetch venues and profiles
    const venueIds = [...new Set(rawClaims.map((c: any) => c.venue_id))];
    const userIds  = [...new Set(rawClaims.map((c: any) => c.user_id))];

    const [venueRes, profileRes] = await Promise.all([
      supabase.from('venues').select('id, name, city').in('id', venueIds),
      supabase.from('profiles').select('id, dj_name, email').in('id', userIds),
    ]);

    const venueMap   = Object.fromEntries((venueRes.data ?? []).map((v: any) => [v.id, v]));
    const profileMap = Object.fromEntries((profileRes.data ?? []).map((p: any) => [p.id, p]));

    setClaims(rawClaims.map((c: any) => ({
      ...c,
      venue_name: venueMap[c.venue_id]?.name,
      venue_city: venueMap[c.venue_id]?.city,
      dj_name:    profileMap[c.user_id]?.dj_name,
      email:      profileMap[c.user_id]?.email,
    })));
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  async function handleApprove(claim: Claim) {
    Alert.alert(
      `Approve claim`,
      `Grant ${claim.name} ownership of ${claim.venue_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', onPress: async () => {
            setActionLoading(claim.id);
            await supabase.from('venue_claims').update({ status: 'approved' }).eq('id', claim.id);
            await supabase.from('venues').update({ owner_id: claim.user_id, is_verified: true }).eq('id', claim.venue_id);
            setActionLoading(null);
            loadClaims();
          },
        },
      ]
    );
  }

  async function handleReject(claim: Claim) {
    Alert.alert(
      'Reject claim',
      `Reject ${claim.name}'s claim for ${claim.venue_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive', onPress: async () => {
            setActionLoading(claim.id);
            await supabase.from('venue_claims').update({ status: 'rejected' }).eq('id', claim.id);
            setActionLoading(null);
            loadClaims();
          },
        },
      ]
    );
  }

  const pendingCount = filter === 'pending' ? claims.length : 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={C.textSec} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.title}>Admin Panel</Text>
          <Text style={s.crown}>👑</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(['pending', 'approved', 'rejected'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>Venue Claims</Text>

      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 40 }} />
      ) : claims.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="flag-outline" size={44} color={C.textMuted} />
          <Text style={s.emptyTitle}>No {filter} claims</Text>
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              {/* Venue */}
              <View style={s.cardHeader}>
                <View style={s.venueIcon}>
                  <Ionicons name="business-outline" size={16} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.venueName}>{item.venue_name ?? 'Unknown venue'}</Text>
                  <Text style={s.venueCity}>{item.venue_city}</Text>
                </View>
                <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
              </View>

              {/* Claimant info */}
              <View style={s.claimantSection}>
                <View style={s.infoRow}>
                  <Ionicons name="person-outline" size={13} color={C.textMuted} />
                  <Text style={s.infoText}>{item.name}</Text>
                  <View style={s.rolePill}>
                    <Text style={s.rolePillText}>{item.role}</Text>
                  </View>
                </View>
                {item.dj_name && (
                  <View style={s.infoRow}>
                    <Ionicons name="headset-outline" size={13} color={C.textMuted} />
                    <Text style={s.infoText}>DJ name: {item.dj_name}</Text>
                  </View>
                )}
                {item.email && (
                  <View style={s.infoRow}>
                    <Ionicons name="mail-outline" size={13} color={C.textMuted} />
                    <Text style={s.infoText}>{item.email}</Text>
                  </View>
                )}
                {item.proof_url && (
                  <TouchableOpacity style={s.infoRow} onPress={() => Linking.openURL(item.proof_url!)}>
                    <Ionicons name="link-outline" size={13} color={C.accent} />
                    <Text style={[s.infoText, { color: C.accent }]} numberOfLines={1}>{item.proof_url}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions */}
              {item.status === 'pending' && (
                <View style={s.actions}>
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color={C.accent} />
                  ) : (
                    <>
                      <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(item)}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                        <Text style={s.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(item)}>
                        <Ionicons name="close" size={15} color={C.critical} />
                        <Text style={s.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {item.status !== 'pending' && (
                <View style={[s.statusPill, item.status === 'approved' ? s.statusApproved : s.statusRejected]}>
                  <Text style={[s.statusText, { color: item.status === 'approved' ? C.success : C.critical }]}>
                    {item.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  crown: { fontSize: 18 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  filterTabActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  filterTabTextActive: { color: C.accent },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  venueIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentDim + '30', alignItems: 'center', justifyContent: 'center' },
  venueName: { fontSize: 15, fontWeight: '700', color: C.text },
  venueCity: { fontSize: 12, color: C.textMuted },
  timeAgo: { fontSize: 11, color: C.textMuted },
  claimantSection: { backgroundColor: C.raised, borderRadius: 10, padding: 12, gap: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: C.textSec, flex: 1 },
  rolePill: { backgroundColor: C.accentDim + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: C.accentDim },
  rolePillText: { fontSize: 11, fontWeight: '700', color: C.accent },
  actions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.success, borderRadius: 10, paddingVertical: 10 },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.critical + '15', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: C.critical + '40' },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: C.critical },
  statusPill: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  statusApproved: { backgroundColor: C.success + '15', borderWidth: 1, borderColor: C.success + '40' },
  statusRejected: { backgroundColor: C.critical + '15', borderWidth: 1, borderColor: C.critical + '40' },
  statusText: { fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
});
