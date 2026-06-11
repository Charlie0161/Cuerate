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

interface Feedback {
  id: string;
  user_id: string | null;
  type: 'bug' | 'idea' | 'other';
  app_area: string | null;
  message: string;
  created_at: string;
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
  const [panel, setPanel] = useState<'claims' | 'feedback' | 'reports'>('claims');

  // Claims state
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [fbFilter, setFbFilter] = useState<'bug' | 'idea' | 'other' | 'all'>('all');

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    const { data: rawClaims } = await supabase
      .from('venue_claims')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (!rawClaims || rawClaims.length === 0) {
      setClaims([]);
      setClaimsLoading(false);
      return;
    }

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
    setClaimsLoading(false);
  }, [filter]);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    let query = supabase.from('beta_feedback').select('*').order('created_at', { ascending: false });
    if (fbFilter !== 'all') query = query.eq('type', fbFilter);
    const { data: rawFb } = await query;

    if (!rawFb || rawFb.length === 0) {
      setFeedback([]);
      setFeedbackLoading(false);
      return;
    }

    const userIds = [...new Set(rawFb.filter((f: any) => f.user_id).map((f: any) => f.user_id))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, dj_name, email').in('id', userIds);
      profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    }

    setFeedback(rawFb.map((f: any) => ({
      ...f,
      dj_name: f.user_id ? profileMap[f.user_id]?.dj_name : undefined,
      email:   f.user_id ? profileMap[f.user_id]?.email : undefined,
    })));
    setFeedbackLoading(false);
  }, [fbFilter]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const { data: raw } = await supabase.from('user_reports').select('*').order('created_at', { ascending: false });
    if (!raw || raw.length === 0) { setReports([]); setReportsLoading(false); return; }
    const ids = [...new Set([...raw.map((r: any) => r.reporter_id), ...raw.map((r: any) => r.reported_id)])];
    const { data: profiles } = await supabase.from('profiles').select('id, dj_name, email').in('id', ids);
    const pm = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    setReports(raw.map((r: any) => ({ ...r, reporter_name: pm[r.reporter_id]?.dj_name, reported_name: pm[r.reported_id]?.dj_name })));
    setReportsLoading(false);
  }, []);

  useEffect(() => { if (panel === 'claims') loadClaims(); }, [loadClaims, panel]);
  useEffect(() => { if (panel === 'feedback') loadFeedback(); }, [loadFeedback, panel]);
  useEffect(() => { if (panel === 'reports') loadReports(); }, [loadReports, panel]);

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

  const typeColor = (t: string) => t === 'bug' ? C.critical : t === 'idea' ? C.success : C.warning;
  const typeLabel = (t: string) => t === 'bug' ? '🐛 Bug' : t === 'idea' ? '💡 Idea' : '💬 General';

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

      {/* Panel switcher */}
      <View style={s.panelRow}>
        <TouchableOpacity style={[s.panelTab, panel === 'claims' && s.panelTabActive]} onPress={() => setPanel('claims')}>
          <Ionicons name="flag-outline" size={15} color={panel === 'claims' ? C.accent : C.textMuted} />
          <Text style={[s.panelTabText, panel === 'claims' && s.panelTabTextActive]}>Venue Claims</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.panelTab, panel === 'feedback' && s.panelTabActive]} onPress={() => setPanel('feedback')}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={panel === 'feedback' ? C.accent : C.textMuted} />
          <Text style={[s.panelTabText, panel === 'feedback' && s.panelTabTextActive]}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.panelTab, panel === 'reports' && s.panelTabActive]} onPress={() => setPanel('reports')}>
          <Ionicons name="flag-outline" size={15} color={panel === 'reports' ? C.critical : C.textMuted} />
          <Text style={[s.panelTabText, panel === 'reports' && { color: C.critical }]}>Reports</Text>
        </TouchableOpacity>
      </View>

      {panel === 'reports' && (
        reportsLoading ? (
          <ActivityIndicator size="large" color={C.critical} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="shield-checkmark-outline" size={44} color={C.textMuted} />
            <Text style={s.emptyTitle}>No reports</Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.venueIcon, { backgroundColor: C.critical + '20' }]}>
                    <Ionicons name="flag" size={16} color={C.critical} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.venueName}>{item.reported_name ?? 'Unknown user'}</Text>
                    <Text style={s.venueCity}>reported by {item.reporter_name ?? 'Unknown'}</Text>
                  </View>
                  <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
                </View>
                <View style={s.claimantSection}>
                  <View style={s.infoRow}>
                    <Ionicons name="alert-circle-outline" size={13} color={C.critical} />
                    <Text style={[s.infoText, { color: C.critical }]}>{item.reason.replace(/_/g, ' ')}</Text>
                  </View>
                  {item.details && (
                    <View style={s.infoRow}>
                      <Ionicons name="document-text-outline" size={13} color={C.textMuted} />
                      <Text style={s.infoText}>{item.details}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        )
      )}

      {panel === 'claims' && (
        <View style={{ flex: 1 }}>
          {/* Claim status filter */}
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

          {claimsLoading ? (
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
        </View>
      )}

      {panel === 'feedback' && (

        <View style={{ flex: 1 }}>
          {/* Feedback type filter */}
          <View style={s.filterRow}>
            {(['all', 'bug', 'idea', 'other'] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, fbFilter === f && s.filterTabActive]}
                onPress={() => setFbFilter(f)}
              >
                <Text style={[s.filterTabText, fbFilter === f && s.filterTabTextActive]}>
                  {f === 'all' ? 'All' : f === 'bug' ? '🐛' : f === 'idea' ? '💡' : '💬'}{f !== 'all' ? ' ' + f.charAt(0).toUpperCase() + f.slice(1) : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedbackLoading ? (
            <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 40 }} />
          ) : feedback.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.textMuted} />
              <Text style={s.emptyTitle}>No feedback yet</Text>
            </View>
          ) : (
            <FlatList
              data={feedback}
              keyExtractor={f => f.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={s.fbHeader}>
                    <View style={[s.typeBadge, { borderColor: typeColor(item.type) + '50', backgroundColor: typeColor(item.type) + '18' }]}>
                      <Text style={[s.typeBadgeText, { color: typeColor(item.type) }]}>{typeLabel(item.type)}</Text>
                    </View>
                    {item.app_area && (
                      <View style={s.areaBadge}>
                        <Text style={s.areaBadgeText}>{item.app_area}</Text>
                      </View>
                    )}
                    <Text style={[s.timeAgo, { marginLeft: 'auto' }]}>{timeAgo(item.created_at)}</Text>
                  </View>

                  <Text style={s.fbMessage}>{item.message}</Text>

                  {(item.dj_name || item.email) && (
                    <View style={s.fbUser}>
                      <Ionicons name="person-outline" size={12} color={C.textMuted} />
                      <Text style={s.fbUserText}>{item.dj_name ?? item.email ?? 'Anonymous'}</Text>
                    </View>
                  )}
                  {!item.user_id && (
                    <View style={s.fbUser}>
                      <Ionicons name="person-outline" size={12} color={C.textMuted} />
                      <Text style={s.fbUserText}>Anonymous</Text>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  crown: { fontSize: 18 },
  panelRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  panelTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  panelTabActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  panelTabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  panelTabTextActive: { color: C.accent },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  filterTabActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  filterTabTextActive: { color: C.accent },
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
  // Feedback styles
  fbHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  typeBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  areaBadge: { backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 3 },
  areaBadgeText: { fontSize: 12, color: C.textSec, fontWeight: '600' },
  fbMessage: { fontSize: 14, color: C.text, lineHeight: 20 },
  fbUser: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  fbUserText: { fontSize: 12, color: C.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
});
