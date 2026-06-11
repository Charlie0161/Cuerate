import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Image, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { DJProfile } from './DJDirectoryScreen';
import MessagesScreen from './MessagesScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623',
  info: '#4DB8FF', soundcloud: '#FF5500',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Mix {
  id: string;
  title: string;
  genre: string | null;
  platform: string;
  external_url: string;
  created_at: string;
  embed_html: string | null;
}

interface TrackSubmission {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  camelot_key: string | null;
  platform: string;
  external_url: string;
}

const KEY_HUE: Record<string, string> = {
  '1':'#7C5CFC','2':'#9B59FC','3':'#B05AF5','4':'#C86EF0','5':'#D97BE8','6':'#E88CE0',
  '7':'#F49CD6','8':'#E8A0C8','9':'#D4A8D0','10':'#C0B0D8','11':'#AAB8E0','12':'#94C0E8',
};
const KEY_HUE_B: Record<string, string> = {
  '1':'#5C9CFC','2':'#5CB8FC','3':'#4CCCE0','4':'#3DDCC0','5':'#40DCA0','6':'#52E080',
  '7':'#6AE060','8':'#8EE040','9':'#B8E040','10':'#DCE040','11':'#ECC840','12':'#F0A040',
};
function keyColor(k: string): string {
  const num = k.replace(/[AB]/, '');
  return k.endsWith('A') ? KEY_HUE[num] ?? C.accent : KEY_HUE_B[num] ?? C.info;
}

const PLATFORM_COLORS: Record<string, string> = {
  soundcloud: '#FF5500', youtube: '#FF0000', mixcloud: '#5000FF',
};

interface DJProfileModalProps {
  dj: DJProfile;
  onClose: () => void;
}

export default function DJProfileModal({ dj, onClose }: DJProfileModalProps) {
  const { user } = useAuthStore();
  const [mixes, setMixes]   = useState<Mix[]>([]);
  const [tracks, setTracks] = useState<TrackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'mixes' | 'tracks'>('mixes');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const initials = dj.dj_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isOwnProfile = user?.id === dj.id;

  useEffect(() => {
    async function fetchFollowData() {
      const { count } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', dj.id);
      setFollowerCount(count ?? 0);
      if (user && !isOwnProfile) {
        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', dj.id)
          .maybeSingle();
        setIsFollowing(!!data);
      }
    }
    fetchFollowData();
  }, [dj.id, user]);

  async function toggleFollow() {
    if (!user) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', dj.id);
      setIsFollowing(false);
      setFollowerCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: dj.id });
      setIsFollowing(true);
      setFollowerCount(c => c + 1);
    }
    setFollowLoading(false);
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [mixRes, trackRes] = await Promise.all([
        supabase
          .from('mixes')
          .select('id, title, genre, platform, external_url, created_at, embed_html')
          .eq('user_id', dj.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('track_submissions')
          .select('id, title, artist, bpm, camelot_key, platform, external_url')
          .eq('submitted_by', dj.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (mixRes.data)   setMixes(mixRes.data as Mix[]);
      if (trackRes.data) setTracks(trackRes.data as TrackSubmission[]);
      setLoading(false);
    }
    fetchData();
  }, [dj.id]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  if (showMessages) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <MessagesScreen
          onClose={() => setShowMessages(false)}
          openWithUserId={dj.id}
          openWithUserName={dj.dj_name}
        />
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Close button */}
        <View style={p.topBar}>
          <TouchableOpacity onPress={onClose} style={p.closeBtn}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={p.hero}>
            {dj.avatar_url ? (
              <Image source={{ uri: dj.avatar_url }} style={p.heroAvatar} />
            ) : (
              <View style={p.heroAvatarPlaceholder}>
                <Text style={p.heroInitials}>{initials}</Text>
              </View>
            )}
            <Text style={p.heroName}>{dj.dj_name}</Text>

            {/* Location + genre */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
              {dj.location && (
                <View style={p.metaChip}>
                  <Ionicons name="location-outline" size={12} color={C.textMuted} />
                  <Text style={p.metaChipText}>{dj.location}</Text>
                </View>
              )}
              {dj.genre && (
                <View style={[p.metaChip, { backgroundColor: C.accentDim + '20', borderColor: C.accent + '40' }]}>
                  <Ionicons name="musical-notes-outline" size={12} color={C.accent} />
                  <Text style={[p.metaChipText, { color: C.accent }]}>{dj.genre}</Text>
                </View>
              )}
            </View>

            {/* Bio */}
            {dj.bio ? (
              <Text style={p.bio}>{dj.bio}</Text>
            ) : null}

            {/* Stats row */}
            <View style={p.statsRow}>
              <View style={p.statItem}>
                <Text style={p.statVal}>{dj.mix_count}</Text>
                <Text style={p.statLabel}>Mixes</Text>
              </View>
              <View style={p.statDivider} />
              <View style={p.statItem}>
                <Text style={p.statVal}>{dj.track_count}</Text>
                <Text style={p.statLabel}>Tracks</Text>
              </View>
              <View style={p.statDivider} />
              <View style={p.statItem}>
                <Text style={p.statVal}>{followerCount}</Text>
                <Text style={p.statLabel}>Followers</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={p.actions}>
              {!isOwnProfile && user && (
                <TouchableOpacity
                  style={[p.actionBtn, isFollowing
                    ? { backgroundColor: C.accentDim + '30', borderColor: C.accent }
                    : { backgroundColor: C.accent, borderColor: C.accent }]}
                  onPress={toggleFollow}
                  disabled={followLoading}
                >
                  {followLoading
                    ? <ActivityIndicator size="small" color={isFollowing ? C.accent : '#fff'} />
                    : <>
                        <Ionicons
                          name={isFollowing ? 'checkmark' : 'person-add-outline'}
                          size={15}
                          color={isFollowing ? C.accent : '#fff'}
                        />
                        <Text style={[p.actionBtnText, { color: isFollowing ? C.accent : '#fff' }]}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              )}
              {dj.soundcloud_url && (
                <TouchableOpacity
                  style={[p.actionBtn, { backgroundColor: '#1A0E00', borderColor: C.soundcloud + '50' }]}
                  onPress={() => Linking.openURL(dj.soundcloud_url!)}
                >
                  <Ionicons name="musical-note" size={15} color={C.soundcloud} />
                  <Text style={[p.actionBtnText, { color: C.soundcloud }]}>SoundCloud</Text>
                </TouchableOpacity>
              )}
              {dj.booking_email && (
                <TouchableOpacity
                  style={[p.actionBtn, { backgroundColor: C.success + '10', borderColor: C.success + '40' }]}
                  onPress={() => Linking.openURL(`mailto:${dj.booking_email}`)}
                >
                  <Ionicons name="mail-outline" size={15} color={C.success} />
                  <Text style={[p.actionBtnText, { color: C.success }]}>Book</Text>
                </TouchableOpacity>
              )}
              {!isOwnProfile && user && (
                <TouchableOpacity
                  style={[p.actionBtn, { backgroundColor: C.accentDim + '20', borderColor: C.accentDim }]}
                  onPress={() => setShowMessages(true)}
                >
                  <Ionicons name="chatbubble-outline" size={15} color={C.accent} />
                  <Text style={[p.actionBtnText, { color: C.accent }]}>Message</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tabs */}
          <View style={p.tabRow}>
            {(['mixes', 'tracks'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[p.tabBtn, tab === t && p.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[p.tabText, tab === t && p.tabTextActive]}>
                  {t === 'mixes' ? `Mixes (${mixes.length})` : `Tracks (${tracks.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ padding: 16 }}>
            {loading ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Mixes tab */}
                {tab === 'mixes' && (
                  mixes.length === 0 ? (
                    <View style={p.emptyTab}>
                      <Ionicons name="radio-outline" size={32} color={C.textMuted} />
                      <Text style={p.emptyTabText}>No mixes shared yet</Text>
                    </View>
                  ) : (
                    mixes.map(mix => (
                      <TouchableOpacity
                        key={mix.id}
                        style={p.mixRow}
                        onPress={() => Linking.openURL(mix.external_url)}
                      >
                        <View style={[p.platformDot, { backgroundColor: PLATFORM_COLORS[mix.platform] ?? C.accent }]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={p.mixTitle} numberOfLines={1}>{mix.title}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                            {mix.genre && <Text style={p.mixMeta}>{mix.genre}</Text>}
                            <Text style={p.mixMeta}>{timeAgo(mix.created_at)}</Text>
                          </View>
                        </View>
                        <Ionicons name="play-circle-outline" size={22} color={C.textMuted} />
                      </TouchableOpacity>
                    ))
                  )
                )}

                {/* Tracks tab */}
                {tab === 'tracks' && (
                  tracks.length === 0 ? (
                    <View style={p.emptyTab}>
                      <Ionicons name="disc-outline" size={32} color={C.textMuted} />
                      <Text style={p.emptyTabText}>No tracks submitted yet</Text>
                    </View>
                  ) : (
                    tracks.map(track => {
                      const col = track.camelot_key ? keyColor(track.camelot_key) : C.accent;
                      return (
                        <TouchableOpacity
                          key={track.id}
                          style={p.trackRow}
                          onPress={() => Linking.openURL(track.external_url)}
                        >
                          {track.camelot_key && (
                            <View style={[p.keyBadge, { backgroundColor: col + '22', borderColor: col + '55' }]}>
                              <Text style={[p.keyBadgeText, { color: col }]}>{track.camelot_key}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={p.mixTitle} numberOfLines={1}>{track.title}</Text>
                            {track.artist && <Text style={p.mixMeta}>{track.artist}</Text>}
                          </View>
                          {track.bpm && <Text style={p.bpmText}>{track.bpm} BPM</Text>}
                          <Ionicons name="open-outline" size={16} color={C.textMuted} />
                        </TouchableOpacity>
                      );
                    })
                  )
                )}
              </>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12 },
  closeBtn: { padding: 4 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  heroAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: C.accent, marginBottom: 12 },
  heroAvatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.accentDim + '50', borderWidth: 3, borderColor: C.accent + '60', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroInitials: { fontSize: 36, fontWeight: '700', color: C.accent },
  heroName: { fontSize: 24, fontWeight: '700', color: C.text, textAlign: 'center' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  metaChipText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  bio: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 20, marginTop: 12, paddingHorizontal: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 16, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal: { fontSize: 22, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: '60%', backgroundColor: C.border },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginTop: 8 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.accent },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  platformDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  mixTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  mixMeta: { fontSize: 11, color: C.textMuted },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  keyBadge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, minWidth: 34, alignItems: 'center' },
  keyBadgeText: { fontSize: 11, fontWeight: '700' },
  bpmText: { fontSize: 12, color: C.textSec },
  emptyTab: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTabText: { fontSize: 14, color: C.textMuted },
});
