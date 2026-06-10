import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, RefreshControl,
  Linking, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  success: '#4DCC8F', successBg: '#071A0F',
  warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
  soundcloud: '#FF5500', mixcloud: '#52AAD8', youtube: '#FF0000',
};

const PLATFORM_COLORS: Record<string, string> = {
  soundcloud: C.soundcloud, mixcloud: C.mixcloud,
  youtube: C.youtube, other: C.textMuted,
};

const PLATFORM_LABELS: Record<string, string> = {
  soundcloud: 'SoundCloud', mixcloud: 'Mixcloud',
  youtube: 'YouTube', other: 'External',
};

const GENRES = ['All', 'House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient'];

type Mix = {
  id: string;
  title: string;
  description: string | null;
  type: 'set' | 'track';
  genre: string | null;
  bpm_range: string | null;
  external_url: string;
  platform: string;
  thumbnail_url: string | null;
  created_at: string;
  dj_name?: string;
  avatar_url?: string | null;
  like_count?: number;
  comment_count?: number;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  profiles?: { dj_name: string | null };
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Mix Card ────────────────────────────────────────────────────────────────
function MixCard({ mix, session, onRefresh }: { mix: Mix; session: any; onRefresh: () => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(mix.like_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const platformColor = PLATFORM_COLORS[mix.platform] ?? C.textMuted;

  useEffect(() => {
    if (session) {
      supabase.from('likes')
        .select('id')
        .eq('mix_id', mix.id)
        .eq('user_id', session.user.id)
        .single()
        .then(({ data }) => setLiked(!!data));
    }
  }, [session]);

  async function handleLike() {
    if (!session) return;
    if (liked) {
      await supabase.from('likes').delete().eq('mix_id', mix.id).eq('user_id', session.user.id);
      setLikeCount(c => c - 1);
    } else {
      await supabase.from('likes').insert({ mix_id: mix.id, user_id: session.user.id });
      setLikeCount(c => c + 1);
    }
    setLiked(!liked);
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(dj_name)')
      .eq('mix_id', mix.id)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setCommentsLoaded(true);
  }

  async function toggleComments() {
    if (!showComments && !commentsLoaded) await loadComments();
    setShowComments(!showComments);
  }

  async function submitComment() {
    if (!newComment.trim() || !session) return;
    setSubmitting(true);
    await supabase.from('comments').insert({
      mix_id: mix.id,
      user_id: session.user.id,
      content: newComment.trim(),
    });
    setNewComment('');
    await loadComments();
    setSubmitting(false);
  }

  return (
    <View style={mc.card}>
      {/* Platform + type badges */}
      <View style={mc.badgeRow}>
        <View style={[mc.badge, { backgroundColor: platformColor + '20', borderColor: platformColor + '50' }]}>
          <Text style={[mc.badgeText, { color: platformColor }]}>{PLATFORM_LABELS[mix.platform]}</Text>
        </View>
        <View style={[mc.badge, {
          backgroundColor: mix.type === 'set' ? C.accentDim + '30' : C.successBg,
          borderColor: mix.type === 'set' ? C.accent + '40' : C.success + '40',
        }]}>
          <Text style={[mc.badgeText, { color: mix.type === 'set' ? C.accent : C.success }]}>
            {mix.type === 'set' ? 'DJ Set' : 'Track'}
          </Text>
        </View>
        {mix.genre && <Text style={mc.genreText}>{mix.genre}</Text>}
      </View>

      {/* Title */}
      <Text style={mc.title}>{mix.title}</Text>

      {/* DJ + time */}
      <View style={mc.djRow}>
        <View style={mc.djAvatar}>
          <Text style={mc.djAvatarText}>{(mix.dj_name ?? 'D')[0].toUpperCase()}</Text>
        </View>
        <Text style={mc.djName}>{mix.dj_name ?? 'Anonymous DJ'}</Text>
        <Text style={mc.time}>{timeAgo(mix.created_at)}</Text>
      </View>

      {/* Description */}
      {mix.description && <Text style={mc.description} numberOfLines={2}>{mix.description}</Text>}

      {/* BPM */}
      {mix.bpm_range && (
        <Text style={mc.bpm}>🎚 {mix.bpm_range} BPM</Text>
      )}

      {/* Actions */}
      <View style={mc.actions}>
        <TouchableOpacity style={mc.actionBtn} onPress={() => Linking.openURL(mix.external_url)}>
          <Ionicons name="play-circle-outline" size={16} color={C.textSec} />
          <Text style={mc.actionText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[mc.actionBtn, liked && mc.actionBtnActive]} onPress={handleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? C.critical : C.textSec} />
          <Text style={[mc.actionText, liked && { color: C.critical }]}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[mc.actionBtn, showComments && mc.actionBtnActive]} onPress={toggleComments}>
          <Ionicons name="chatbubble-outline" size={15} color={showComments ? C.accent : C.textSec} />
          <Text style={[mc.actionText, showComments && { color: C.accent }]}>{mix.comment_count ?? 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={mc.actionBtn} onPress={() => Linking.openURL(`https://boothbuddy-web.vercel.app`)}>
          <Ionicons name="open-outline" size={15} color={C.textSec} />
          <Text style={mc.actionText}>Web</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
      {showComments && (
        <View style={mc.commentsSection}>
          {comments.length === 0 && commentsLoaded ? (
            <Text style={mc.noComments}>No comments yet. Be first!</Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={mc.comment}>
                <View style={mc.commentAvatar}>
                  <Text style={mc.commentAvatarText}>{(c.profiles?.dj_name ?? 'D')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mc.commentAuthor}>{c.profiles?.dj_name ?? 'DJ'}</Text>
                  <Text style={mc.commentText}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
          {session ? (
            <View style={mc.commentInput}>
              <TextInput
                style={mc.commentField}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Add a comment..."
                placeholderTextColor={C.textMuted}
              />
              <TouchableOpacity
                style={[mc.commentSubmit, (!newComment.trim() || submitting) && { opacity: 0.4 }]}
                onPress={submitComment}
                disabled={!newComment.trim() || submitting}>
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={mc.commentSubmitText}>Post</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={mc.noComments}>Sign in to comment</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MixesScreen() {
  const { session } = useAuthStore();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'set' | 'track'>('all');
  const [genre, setGenre] = useState('All');
  const [search, setSearch] = useState('');

  const fetchMixes = useCallback(async () => {
    let query = supabase
      .from('mix_feed')
      .select('*')
      .order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('type', filter);
    if (genre !== 'All') query = query.eq('genre', genre);
    const { data } = await query;
    setMixes(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [filter, genre]);

  useEffect(() => { fetchMixes(); }, [fetchMixes]);

  const filtered = search
    ? mixes.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.dj_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.genre?.toLowerCase().includes(search.toLowerCase())
      )
    : mixes;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>Community</Text>
          <Text style={s.title}>Mixes & Sets</Text>
        </View>
        <TouchableOpacity
          style={s.webBtn}
          onPress={() => Linking.openURL('https://boothbuddy-web.vercel.app')}>
          <Ionicons name="globe-outline" size={14} color={C.accent} />
          <Text style={s.webBtnText}>Web</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={15} color={C.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search DJs, genres, titles..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <View style={s.filterRow}>
        {(['all', 'set', 'track'] as const).map(f => (
          <TouchableOpacity key={f}
            style={[s.filterPill, filter === f && s.filterPillActive]}
            onPress={() => setFilter(f)}>
            <Text style={[s.filterPillText, filter === f && { color: C.accent }]}>
              {f === 'all' ? 'All' : f === 'set' ? 'DJ Sets' : 'Tracks'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Genre scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.genreScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
        {GENRES.map(g => (
          <TouchableOpacity key={g}
            style={[s.genrePill, genre === g && s.genrePillActive]}
            onPress={() => setGenre(g)}>
            <Text style={[s.genrePillText, genre === g && { color: C.accent }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="musical-notes-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyTitle}>{search ? 'No results found' : 'No mixes yet'}</Text>
          <Text style={s.emptyBody}>
            {search ? 'Try a different search' : 'Be first to share a mix at boothbuddy-web.vercel.app'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMixes(); }}
              tintColor={C.accent}
            />
          }
          renderItem={({ item }) => (
            <MixCard mix={item} session={session} onRefresh={fetchMixes} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  webBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  webBtnText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  filterPillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: C.textSec },
  genreScroll: { flexGrow: 0 },
  genrePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  genrePillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 21 },
});

const mc = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  genreText: { fontSize: 11, color: C.textMuted },
  title: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8, lineHeight: 22 },
  djRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  djAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentDim + '50', alignItems: 'center', justifyContent: 'center' },
  djAvatarText: { fontSize: 11, fontWeight: '700', color: C.accent },
  djName: { fontSize: 13, color: C.textSec, fontWeight: '500', flex: 1 },
  time: { fontSize: 12, color: C.textMuted },
  description: { fontSize: 13, color: C.textSec, lineHeight: 18, marginBottom: 6 },
  bpm: { fontSize: 12, color: C.textMuted, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: C.border },
  actionBtnActive: { borderColor: C.accent + '40', backgroundColor: C.accentDim + '20' },
  actionText: { fontSize: 12, color: C.textSec, fontWeight: '600' },
  commentsSection: { marginTop: 12, gap: 8 },
  noComments: { fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 8 },
  comment: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.accentDim + '40', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 10, fontWeight: '700', color: C.accent },
  commentAuthor: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 2 },
  commentText: { fontSize: 13, color: C.text, lineHeight: 18 },
  commentInput: { flexDirection: 'row', gap: 8, marginTop: 6 },
  commentField: { flex: 1, backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.text },
  commentSubmit: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.accent },
  commentSubmitText: { fontSize: 13, color: '#fff', fontWeight: '600' },
});
