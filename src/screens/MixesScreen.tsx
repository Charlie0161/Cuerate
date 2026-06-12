import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, RefreshControl,
  Linking, FlatList, Image, Modal, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { MixCardSkeleton, DJCardSkeleton } from '../components/SkeletonCard';
import PostMixModal from './PostMixModal';
import ProfileNudge from '../components/ProfileNudge';
import ProfileScreen from './ProfileScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  success: '#4DCC8F', successBg: '#071A0F',
  warning: '#F5A623',
  info: '#4DB8FF',
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
  user_id?: string;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  profiles?: { dj_name: string | null };
};

type TrackItem = {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  camelot_key: string | null;
  musical_key: string | null;
  energy: number | null;
  platform: string;
  external_url: string;
  thumbnail_url: string | null;
  created_at: string;
  dj_name?: string | null;
  _kind: 'track_submission';
};

type FeedItem = (Mix & { _kind: 'mix' }) | TrackItem;

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

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}


// ─── Track Submission Card ────────────────────────────────────────────────────
function TrackCard({ track }: { track: TrackItem }) {
  const platformColor = PLATFORM_COLORS[track.platform] ?? C.textMuted;
  const col = track.camelot_key ? keyColor(track.camelot_key) : C.accent;
  const energyInt = track.energy ? Math.round(track.energy * 10) : null;

  return (
    <TouchableOpacity
      style={[mc.card, { borderColor: col + '33' }]}
      onPress={() => Linking.openURL(track.external_url)}
      activeOpacity={0.8}
    >
      {/* Badges */}
      <View style={mc.badgeRow}>
        <View style={[mc.badge, { backgroundColor: platformColor + '20', borderColor: platformColor + '50' }]}>
          <Text style={[mc.badgeText, { color: platformColor }]}>{PLATFORM_LABELS[track.platform] ?? track.platform}</Text>
        </View>
        <View style={[mc.badge, { backgroundColor: C.successBg, borderColor: C.success + '40' }]}>
          <Text style={[mc.badgeText, { color: C.success }]}>Track</Text>
        </View>
        {track.camelot_key && (
          <View style={[mc.badge, { backgroundColor: col + '18', borderColor: col + '44' }]}>
            <Text style={[mc.badgeText, { color: col }]}>{track.camelot_key}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={mc.title}>{track.title}</Text>

      {/* Artist + time */}
      <View style={mc.djRow}>
        {track.artist ? (
          <>
            <View style={mc.djAvatar}>
              <Text style={mc.djAvatarText}>{track.artist[0].toUpperCase()}</Text>
            </View>
            <Text style={mc.djName}>{track.artist}</Text>
          </>
        ) : (
          <Text style={mc.djName}>Unknown artist</Text>
        )}
        <Text style={mc.time}>{timeAgo(track.created_at)}</Text>
      </View>

      {/* BPM + key + energy row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {track.bpm && (
          <View style={[mc.badge, { backgroundColor: C.raised, borderColor: C.border }]}>
            <Text style={[mc.badgeText, { color: C.textSec }]}>🎚 {track.bpm} BPM</Text>
          </View>
        )}
        {track.camelot_key && track.musical_key && (
          <View style={[mc.badge, { backgroundColor: col + '18', borderColor: col + '33' }]}>
            <Text style={[mc.badgeText, { color: col }]}>{track.musical_key} ({track.camelot_key})</Text>
          </View>
        )}
        {energyInt !== null && (
          <View style={[mc.badge, { backgroundColor: C.raised, borderColor: C.border }]}>
            <Text style={[mc.badgeText, { color: C.textMuted }]}>Energy {energyInt}/10</Text>
          </View>
        )}
      </View>

      {/* Submitted by */}
      {track.dj_name && (
        <Text style={[mc.bpm, { marginBottom: 10 }]}>Added by {track.dj_name}</Text>
      )}

      {/* Actions */}
      <View style={mc.actions}>
        <TouchableOpacity style={mc.actionBtn} onPress={() => Linking.openURL(track.external_url)}>
          <Ionicons name="play-circle-outline" size={16} color={C.textSec} />
          <Text style={mc.actionText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={mc.actionBtn} onPress={() => Linking.openURL('https://cuerate.co.uk/tracks')}>
          <Ionicons name="open-outline" size={15} color={C.textSec} />
          <Text style={mc.actionText}>View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Edit Mix Modal ──────────────────────────────────────────────────────────
const EDIT_GENRES = ['House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other'];

function EditMixModal({ mix, onClose, onSuccess }: { mix: Mix; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(mix.title);
  const [description, setDescription] = useState(mix.description ?? '');
  const [type, setType] = useState<'set' | 'track'>(mix.type);
  const [genre, setGenre] = useState(mix.genre ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    const { error: dbErr } = await supabase
      .from('mixes')
      .update({ title: title.trim(), description: description.trim() || null, type, genre: genre || null })
      .eq('id', mix.id);
    setSaving(false);
    if (dbErr) { setError('Failed to save — try again.'); return; }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={em.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
          <Text style={em.headerTitle}>Edit mix</Text>
          <TouchableOpacity style={[em.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={em.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={em.body} keyboardShouldPersistTaps="handled">
          <Text style={em.label}>Title</Text>
          <TextInput style={em.input} value={title} onChangeText={setTitle} placeholderTextColor={C.textMuted} />

          <Text style={em.label}>Type</Text>
          <View style={em.typeRow}>
            {(['set', 'track'] as const).map(t => (
              <TouchableOpacity key={t} style={[em.typeBtn, type === t && em.typeBtnActive]} onPress={() => setType(t)}>
                <Ionicons name={t === 'set' ? 'disc-outline' : 'musical-note-outline'} size={15} color={type === t ? C.accent : C.textSec} />
                <Text style={[em.typeBtnText, type === t && { color: C.accent }]}>{t === 'set' ? 'DJ Set' : 'Track'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={em.label}>Genre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {EDIT_GENRES.map(g => (
              <TouchableOpacity
                key={g}
                style={[em.genrePill, genre === g && em.genrePillActive]}
                onPress={() => setGenre(genre === g ? '' : g)}
              >
                <Text style={[em.genrePillText, genre === g && { color: C.accent }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={em.label}>Description</Text>
          <TextInput
            style={[em.input, em.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tracklist, notes…"
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={4}
          />

          {error && <Text style={em.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const em = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  saveBtn: { backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  body: { padding: 16, gap: 4, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  typeBtnActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: C.textSec },
  genrePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  genrePillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  error: { fontSize: 13, color: C.critical, marginTop: 12, textAlign: 'center' },
});

// ─── Mix Card ────────────────────────────────────────────────────────────────
function MixCard({ mix, session, onRefresh }: { mix: Mix; session: any; onRefresh: () => void }) {
  const [showEdit, setShowEdit] = useState(false);
  const isOwner = !!session && session.user.id === mix.user_id;
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await supabase.from('likes').insert({ mix_id: mix.id, user_id: session.user.id });
      setLikeCount(c => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        <TouchableOpacity style={mc.actionBtn} onPress={() => Linking.openURL(`https://cuerate.co.uk`)}>
          <Ionicons name="open-outline" size={15} color={C.textSec} />
          <Text style={mc.actionText}>Web</Text>
        </TouchableOpacity>
        <TouchableOpacity style={mc.actionBtn} onPress={() => Share.share({ message: `Check out this mix on Cuerate: ${mix.external_url}`, url: mix.external_url })}>
          <Ionicons name="share-outline" size={15} color={C.textSec} />
          <Text style={mc.actionText}>Share</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity style={mc.actionBtn} onPress={() => setShowEdit(true)}>
            <Ionicons name="pencil-outline" size={15} color={C.textSec} />
            <Text style={mc.actionText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={mc.actionBtn} onPress={() => {
            Alert.alert('Delete mix', 'Remove this from the feed?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                await supabase.from('mixes').delete().eq('id', mix.id);
                onRefresh();
              }},
            ]);
          }}>
            <Ionicons name="trash-outline" size={15} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {showEdit && (
        <EditMixModal
          mix={mix}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); onRefresh(); }}
        />
      )}

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

// ─── Suggested DJs ───────────────────────────────────────────────────────────
type DJSuggestion = {
  id: string;
  dj_name: string | null;
  genre: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  soundcloud_avatar: string | null;
};

const GENRE_FILTERS = ['All', 'House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient'];

function SuggestedDJs({ currentUserId, onFollowed }: { currentUserId: string; onFollowed: () => void }) {
  const [djs, setDjs] = useState<DJSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState('All');
  const [areaSearch, setAreaSearch] = useState('');
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('profiles')
      .select('id, dj_name, genre, location, bio, avatar_url, soundcloud_avatar')
      .neq('id', currentUserId)
      .eq('is_public', true)
      .not('dj_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (genreFilter !== 'All') q = q.ilike('genre', `%${genreFilter}%`);
    if (areaSearch.trim()) q = q.ilike('location', `%${areaSearch.trim()}%`);

    const { data } = await q;
    setDjs(data ?? []);
    setLoading(false);
  }, [genreFilter, areaSearch, currentUserId]);

  useEffect(() => { load(); }, [load]);

  async function handleFollow(djId: string) {
    if (following.has(djId)) return;
    setFollowing(prev => new Set(prev).add(djId));
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: djId });
    onFollowed();
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={sg.headerRow}>
        <Ionicons name="people-outline" size={20} color={C.accent} />
        <Text style={sg.heading}>Suggested DJs to follow</Text>
      </View>

      {/* Area search */}
      <View style={sg.searchBar}>
        <Ionicons name="location-outline" size={14} color={C.textMuted} />
        <TextInput
          style={sg.searchInput}
          placeholder="Filter by city or area..."
          placeholderTextColor={C.textMuted}
          value={areaSearch}
          onChangeText={setAreaSearch}
        />
        {areaSearch !== '' && (
          <TouchableOpacity onPress={() => setAreaSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={15} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Genre chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
        {GENRE_FILTERS.map(g => (
          <TouchableOpacity
            key={g}
            style={[sg.genrePill, genreFilter === g && sg.genrePillActive]}
            onPress={() => setGenreFilter(g)}
          >
            <Text style={[sg.genrePillText, genreFilter === g && { color: C.accent }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <FlatList data={[1,2,3,4,5]} keyExtractor={i => String(i)} scrollEnabled={false} contentContainerStyle={{ padding: 16, gap: 10 }} renderItem={() => <DJCardSkeleton />} />
      ) : djs.length === 0 ? (
        <View style={sg.empty}>
          <Ionicons name="search-outline" size={40} color={C.textMuted} />
          <Text style={sg.emptyText}>No DJs found{genreFilter !== 'All' ? ` for ${genreFilter}` : ''}{areaSearch ? ` in "${areaSearch}"` : ''}</Text>
          <TouchableOpacity onPress={() => { setGenreFilter('All'); setAreaSearch(''); }}>
            <Text style={sg.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={djs}
          keyExtractor={d => d.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const avatarUri = item.avatar_url ?? item.soundcloud_avatar;
            const initials = (item.dj_name ?? 'D')[0].toUpperCase();
            const followed = following.has(item.id);
            return (
              <View style={sg.card}>
                <View style={sg.avatarWrap}>
                  {avatarUri
                    ? <Image source={{ uri: avatarUri }} style={sg.avatar} />
                    : <View style={sg.avatarPlaceholder}><Text style={sg.avatarInitials}>{initials}</Text></View>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sg.name}>{item.dj_name}</Text>
                  <View style={sg.metaRow}>
                    {item.genre && (
                      <View style={sg.metaChip}>
                        <Ionicons name="musical-note-outline" size={11} color={C.accent} />
                        <Text style={sg.metaChipText}>{item.genre}</Text>
                      </View>
                    )}
                    {item.location && (
                      <View style={sg.metaChip}>
                        <Ionicons name="location-outline" size={11} color={C.textMuted} />
                        <Text style={[sg.metaChipText, { color: C.textMuted }]}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                  {item.bio && <Text style={sg.bio} numberOfLines={1}>{item.bio}</Text>}
                </View>
                <TouchableOpacity
                  style={[sg.followBtn, followed && sg.followBtnDone]}
                  onPress={() => handleFollow(item.id)}
                  disabled={followed}
                >
                  <Ionicons name={followed ? 'checkmark' : 'add'} size={15} color={followed ? C.success : '#fff'} />
                  <Text style={[sg.followBtnText, followed && { color: C.success }]}>{followed ? 'Following' : 'Follow'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── For You Feed ────────────────────────────────────────────────────────────
function ForYouFeed({ userId, userGenre, session }: { userId: string; userGenre: string | null; session: any }) {
  const [picks, setPicks] = useState<(Mix & { _kind: 'mix' })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Fetch liked IDs and followed user IDs in parallel
    const [{ data: likedData }, { data: followData }] = await Promise.all([
      supabase.from('likes').select('mix_id').eq('user_id', userId),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
    ]);
    const likedIds = new Set((likedData ?? []).map((l: any) => l.mix_id));
    const followedIds = new Set((followData ?? []).map((f: any) => f.following_id));

    // Fetch a broad pool — genre-matched + popular fallback
    const genreKey = userGenre?.split(' ')[0] ?? null;
    const [{ data: genrePool }, { data: popularPool }] = await Promise.all([
      genreKey
        ? supabase.from('mix_feed').select('*').ilike('genre', `%${genreKey}%`).limit(100)
        : Promise.resolve({ data: [] }),
      supabase.from('mix_feed').select('*').order('like_count', { ascending: false }).limit(100),
    ]);

    const seen = new Set<string>();
    const pool: any[] = [];
    for (const m of [...(genrePool ?? []), ...(popularPool ?? [])]) {
      if (!seen.has(m.id) && !likedIds.has(m.id)) { seen.add(m.id); pool.push(m); }
    }

    // Score each mix: recency (decay) + likes + comments + follow boost
    const now = Date.now();
    const scored = pool.map(m => {
      const ageHours = (now - new Date(m.created_at).getTime()) / 3_600_000;
      const recencyScore = Math.max(0, 1 - ageHours / (7 * 24)); // decay over 7 days
      const likeScore = Math.min((m.like_count ?? 0) / 50, 1);
      const commentScore = Math.min((m.comment_count ?? 0) / 20, 1);
      const followBoost = followedIds.has(m.user_id) ? 0.4 : 0;
      const genreBoost = genreKey && m.genre?.toLowerCase().includes(genreKey.toLowerCase()) ? 0.3 : 0;
      const score = recencyScore * 0.35 + likeScore * 0.3 + commentScore * 0.15 + followBoost + genreBoost;
      return { m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    setPicks(scored.slice(0, 40).map(({ m }) => ({ ...m, _kind: 'mix' as const })));
  }, [userId, userGenre]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={i => String(i)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        scrollEnabled={false}
        renderItem={() => <MixCardSkeleton />}
      />
    );
  }

  if (picks.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="sparkles-outline" size={48} color={C.textMuted} />
        <Text style={s.emptyTitle}>Nothing to recommend yet</Text>
        <Text style={s.emptyBody}>Like some mixes and make sure your profile genre is set so we can tailor this feed.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={picks}
      keyExtractor={m => m.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      maxToRenderPerBatch={6}
      windowSize={5}
      initialNumToRender={6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Ionicons name="sparkles" size={13} color={C.accent} />
          <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '600' }}>
            {userGenre ? `Based on your ${userGenre} taste` : 'Top mixes right now'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <MixCard mix={item} session={session} onRefresh={load} />
      )}
    />
  );
}

// ─── SoundCloud Sync Banner ──────────────────────────────────────────────────
function SoundCloudSyncBanner({ userId, username }: { userId: string; username: string }) {
  const [hasImported, setHasImported] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const inputRef = React.useRef<any>(null);

  useEffect(() => {
    supabase
      .from('mixes')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'soundcloud')
      .limit(1)
      .then(({ data }) => setHasImported((data?.length ?? 0) > 0));
  }, [userId]);

  if (hasImported !== false) return null;

  async function addByUrl() {
    const trimmed = url.trim();
    if (!trimmed.includes('soundcloud.com/')) {
      setResult('Paste a SoundCloud link, e.g. soundcloud.com/yourname/your-set');
      return;
    }
    setAdding(true);
    setResult(null);
    try {
      // oEmbed is public — no client_id needed
      const oembedRes = await fetch(
        `https://soundcloud.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`
      );
      if (!oembedRes.ok) {
        setResult('Could not find that track — check the link and try again.');
        return;
      }
      const oembed = await oembedRes.json();
      const isSet = trimmed.includes('/sets/');
      const canonicalUrl = trimmed.split('?')[0].replace(/\/$/, '');

      const { data, error } = await supabase
        .from('mixes')
        .upsert({
          user_id: userId,
          title: oembed.title ?? 'Untitled',
          description: null,
          type: isSet ? 'set' : 'track',
          platform: 'soundcloud',
          external_url: canonicalUrl,
          thumbnail_url: oembed.thumbnail_url ?? null,
          genre: null,
        }, { onConflict: 'user_id,external_url', ignoreDuplicates: true })
        .select('id');

      if (error) { setResult('Failed to save — try again.'); return; }
      setResult('Added! Paste another link or close.');
      setUrl('');
      setHasImported(false); // keep banner open so they can add more
      // re-check after short delay in case they added their first
      setTimeout(() => {
        supabase.from('mixes').select('id').eq('user_id', userId).eq('platform', 'soundcloud').limit(1)
          .then(({ data }) => setHasImported((data?.length ?? 0) > 0));
      }, 1000);
    } catch {
      setResult('Something went wrong — check your connection.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={scb.wrap}>
      <View style={scb.header}>
        <View style={scb.iconWrap}>
          <Ionicons name="musical-note" size={16} color="#FF5500" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={scb.title}>Add your SoundCloud sets</Text>
          <Text style={scb.sub}>Paste a link to any public track or set</Text>
        </View>
      </View>
      <View style={scb.inputRow}>
        <TextInput
          ref={inputRef}
          style={scb.input}
          value={url}
          onChangeText={setUrl}
          placeholder="soundcloud.com/yourname/your-set"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={addByUrl}
        />
        <TouchableOpacity style={[scb.btn, adding && { opacity: 0.6 }]} onPress={addByUrl} disabled={adding}>
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="add" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
      {result && <Text style={scb.result}>{result}</Text>}
    </View>
  );
}

const scb = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#1A0E00', borderRadius: 12, borderWidth: 1, borderColor: '#FF550040', padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF550020', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: C.text },
  sub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: '#FF550040', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.text },
  btn: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FF5500', alignItems: 'center', justifyContent: 'center' },
  result: { fontSize: 12, color: C.textSec },
});

// ─── Gig Countdown Banner ─────────────────────────────────────────────────────
function GigCountdownBanner({ userId }: { userId: string }) {
  const [nextGig, setNextGig] = useState<{ venue_name: string; date: string; start_time: string | null } | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('dj_gigs')
      .select('venue_name, date, start_time')
      .eq('dj_id', userId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()
      .then(({ data }) => setNextGig(data ?? null));
  }, [userId]);

  if (!nextGig) return null;

  const days = Math.ceil((new Date(nextGig.date).getTime() - Date.now()) / 86400000);
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  const urgent = days <= 2;

  return (
    <View style={[cb.banner, urgent && cb.bannerUrgent]}>
      <Ionicons name="musical-notes-outline" size={14} color={urgent ? C.warning : C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[cb.bannerTitle, urgent && { color: C.warning }]} numberOfLines={1}>
          Next gig: {nextGig.venue_name}
        </Text>
        <Text style={cb.bannerSub}>
          {label}{nextGig.start_time ? ` · ${nextGig.start_time}` : ''}
        </Text>
      </View>
      <View style={[cb.dayBadge, urgent && { backgroundColor: C.warning + '20', borderColor: C.warning + '60' }]}>
        <Text style={[cb.dayBadgeText, urgent && { color: C.warning }]}>{days}d</Text>
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, backgroundColor: C.accentDim + '25', borderRadius: 12, borderWidth: 1, borderColor: C.accent + '40', padding: 12 },
  bannerUrgent: { backgroundColor: C.warning + '12', borderColor: C.warning + '40' },
  bannerTitle: { fontSize: 13, fontWeight: '700', color: C.accent },
  bannerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  dayBadge: { backgroundColor: C.accentDim + '40', borderRadius: 8, borderWidth: 1, borderColor: C.accent + '40', paddingHorizontal: 8, paddingVertical: 4 },
  dayBadgeText: { fontSize: 13, fontWeight: '800', color: C.accent },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MixesScreen() {
  const { session, user, profile, initialized } = useAuthStore();
  const [mixes, setMixes] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'set' | 'track'>('all');
  const [genre, setGenre] = useState('All');
  const [search, setSearch] = useState('');
  const [feedMode, setFeedMode] = useState<'all' | 'forYou' | 'following'>('all');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(({ data }) => setFollowingIds((data ?? []).map((r: any) => r.following_id)));
  }, [user]);

  const fetchMixes = useCallback(async () => {
    let mixQuery = supabase
      .from('mix_feed')
      .select('*')
      .order('created_at', { ascending: false });
    if (filter === 'set') mixQuery = mixQuery.eq('type', 'set');
    if (filter === 'track') mixQuery = mixQuery.eq('type', 'track');
    if (genre !== 'All') mixQuery = mixQuery.eq('genre', genre);
    if (feedMode === 'following' && followingIds.length > 0) {
      mixQuery = mixQuery.in('user_id', followingIds);
    }
    const [mixRes, trackRes] = await Promise.all([
      mixQuery,
      filter === 'set' ? Promise.resolve({ data: [] }) :
        supabase
          .from('track_submissions')
          .select('id, title, artist, bpm, camelot_key, musical_key, energy, platform, external_url, thumbnail_url, created_at, status, profiles:submitted_by(dj_name, id)')
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(50),
    ]);

    let mixes: FeedItem[] = (mixRes.data ?? []).map((m: any) => ({ ...m, _kind: 'mix' as const }));
    let tracks: FeedItem[] = (trackRes.data ?? []).map((t: any) => ({
      ...t,
      dj_name: t.profiles?.dj_name ?? null,
      _kind: 'track_submission' as const,
    }));

    if (feedMode === 'following' && followingIds.length > 0) {
      tracks = tracks.filter((t: any) => followingIds.includes(t.profiles?.id));
    }

    const merged = [...mixes, ...tracks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setMixes(merged);
    setLoading(false);
    setRefreshing(false);
  }, [filter, genre, feedMode, followingIds]);

  useEffect(() => { if (initialized) fetchMixes(); }, [initialized, fetchMixes]);

  const filtered = search
    ? mixes.filter(m => {
        const q = search.toLowerCase();
        const titleMatch = m.title.toLowerCase().includes(q);
        const djMatch = (m.dj_name ?? '').toLowerCase().includes(q);
        const genreMatch = m._kind === 'mix' ? (m.genre ?? '').toLowerCase().includes(q) : false;
        const artistMatch = m._kind === 'track_submission' ? (m.artist ?? '').toLowerCase().includes(q) : false;
        return titleMatch || djMatch || genreMatch || artistMatch;
      })
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
          onPress={() => Linking.openURL('https://cuerate.co.uk')}>
          <Ionicons name="globe-outline" size={14} color={C.accent} />
          <Text style={s.webBtnText}>Web</Text>
        </TouchableOpacity>
      </View>

      {/* Feed mode switcher */}
      <View style={s.feedSwitcher}>
        {(['all', 'forYou', 'following'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[s.feedTab, feedMode === mode && s.feedTabActive]}
            onPress={() => setFeedMode(mode)}
          >
            <Text style={[s.feedTabText, feedMode === mode && s.feedTabTextActive]}>
              {mode === 'all' ? 'All' : mode === 'forYou' ? 'For You ✦' : 'Following'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Profile completion nudge */}
      <ProfileNudge onPress={() => setShowProfile(true)} />

      {/* SoundCloud import nudge */}
      {user && profile?.soundcloud_username && feedMode !== 'following' && (
        <SoundCloudSyncBanner userId={user.id} username={profile.soundcloud_username} />
      )}

      {/* Gig countdown */}
      {user && <GigCountdownBanner userId={user.id} />}

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

      {/* For You full feed */}
      {feedMode === 'forYou' && (
        session ? (
          <ForYouFeed userId={user!.id} userGenre={profile?.genre ?? null} session={session} />
        ) : (
          <View style={s.empty}>
            <Ionicons name="sparkles-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyTitle}>Sign in for a personalised feed</Text>
            <Text style={s.emptyBody}>We'll recommend mixes based on your genre and listening history.</Text>
          </View>
        )
      )}

      {/* All / Following feed */}
      {feedMode !== 'forYou' && (loading ? (
        <FlatList
          data={[1, 2, 3, 4, 5]}
          keyExtractor={i => String(i)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          scrollEnabled={false}
          renderItem={() => <MixCardSkeleton />}
        />
      ) : feedMode === 'following' && !session ? (
        <View style={s.empty}>
          <Ionicons name="person-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyTitle}>Sign in to see your feed</Text>
          <Text style={s.emptyBody}>Follow DJs to see their latest mixes here.</Text>
        </View>
      ) : feedMode === 'following' && followingIds.length === 0 ? (
        <SuggestedDJs
          currentUserId={user!.id}
          onFollowed={() => {
            supabase.from('follows').select('following_id').eq('follower_id', user!.id)
              .then(({ data }) => setFollowingIds((data ?? []).map((r: any) => r.following_id)));
          }}
        />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="musical-notes-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyTitle}>{search ? 'No results found' : feedMode === 'following' ? 'No mixes from people you follow yet' : 'No mixes yet'}</Text>
          <Text style={s.emptyBody}>
            {search ? 'Try a different search' : feedMode === 'following' ? 'The DJs you follow haven\'t posted any mixes yet.' : 'Be first to share a mix at cuerate.co.uk'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMixes(); }}
              tintColor={C.accent}
            />
          }
          renderItem={({ item }) => (
            item._kind === 'track_submission'
              ? <TrackCard track={item as TrackItem} />
              : <MixCard mix={item as Mix & { _kind: 'mix' }} session={session} onRefresh={fetchMixes} />
          )}
        />
      ))}
      {/* FAB — share a mix */}
      {session && (
        <TouchableOpacity style={s.fab} onPress={() => setShowPostModal(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {showPostModal && (
        <PostMixModal
          onClose={() => setShowPostModal(false)}
          onSuccess={() => {
            setShowPostModal(false);
            fetchMixes();
          }}
        />
      )}

      <Modal visible={showProfile} animationType="slide" presentationStyle="pageSheet">
        <ProfileScreen onClose={() => setShowProfile(false)} />
      </Modal>
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
  feedSwitcher: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 3 },
  feedTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  feedTabActive: { backgroundColor: C.accent },
  feedTabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  feedTabTextActive: { color: '#fff' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 21 },
});

const sg = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: C.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  genrePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  genrePillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12 },
  avatarWrap: { width: 46, height: 46 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.accentDim + '50', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 18, fontWeight: '700', color: C.accent },
  name: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaChipText: { fontSize: 11, fontWeight: '600', color: C.accent },
  bio: { fontSize: 12, color: C.textMuted },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.accent },
  followBtnDone: { backgroundColor: C.success + '20', borderWidth: 1, borderColor: C.success + '60' },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 15, color: C.textSec, textAlign: 'center' },
  clearText: { fontSize: 13, color: C.accent, fontWeight: '600' },
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
