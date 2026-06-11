import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import DJProfileModal from './DJProfileModal';
import VenueDirectoryScreen from './VenueDirectoryScreen';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  info: '#4DB8FF', soundcloud: '#FF5500',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const GENRES = [
  'All', 'House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle',
  'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DJProfile {
  id: string;
  dj_name: string;
  bio: string | null;
  avatar_url: string | null;
  soundcloud_url: string | null;
  soundcloud_username: string | null;
  genre: string | null;
  location: string | null;
  booking_email: string | null;
  mix_count: number;
  track_count: number;
  created_at: string;
}

// ─── DJ Card ──────────────────────────────────────────────────────────────────

function DJCard({ dj, onPress }: { dj: DJProfile; onPress: () => void }) {
  const initials = dj.dj_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity style={d.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={d.cardTop}>
        {dj.avatar_url ? (
          <Image source={{ uri: dj.avatar_url }} style={d.avatar} />
        ) : (
          <View style={d.avatarPlaceholder}>
            <Text style={d.avatarInitials}>{initials}</Text>
          </View>
        )}
        {/* Genre badge */}
        {dj.genre && (
          <View style={d.genreBadge}>
            <Text style={d.genreBadgeText}>{dj.genre}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={d.cardBody}>
        <Text style={d.djName} numberOfLines={1}>{dj.dj_name}</Text>

        {dj.location ? (
          <View style={d.locationRow}>
            <Ionicons name="location-outline" size={11} color={C.textMuted} />
            <Text style={d.locationText} numberOfLines={1}>{dj.location}</Text>
          </View>
        ) : null}

        {dj.bio ? (
          <Text style={d.bio} numberOfLines={2}>{dj.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={d.statsRow}>
          {dj.mix_count > 0 && (
            <View style={d.stat}>
              <Text style={d.statVal}>{dj.mix_count}</Text>
              <Text style={d.statLabel}>mix{dj.mix_count !== 1 ? 'es' : ''}</Text>
            </View>
          )}
          {dj.track_count > 0 && (
            <View style={d.stat}>
              <Text style={d.statVal}>{dj.track_count}</Text>
              <Text style={d.statLabel}>track{dj.track_count !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {dj.soundcloud_username && (
            <View style={[d.stat, { marginLeft: 'auto' as any }]}>
              <Ionicons name="musical-note" size={12} color={C.soundcloud} />
            </View>
          )}
          {dj.booking_email && (
            <View style={d.bookingBadge}>
              <Ionicons name="mail-outline" size={10} color={C.success} />
              <Text style={d.bookingBadgeText}>For hire</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={[d.card, { opacity: 0.4 }]}>
      <View style={[d.avatar, { backgroundColor: C.raised }]} />
      <View style={d.cardBody}>
        <View style={{ height: 14, backgroundColor: C.raised, borderRadius: 4, width: '60%', marginBottom: 8 }} />
        <View style={{ height: 11, backgroundColor: C.raised, borderRadius: 4, width: '40%', marginBottom: 8 }} />
        <View style={{ height: 11, backgroundColor: C.raised, borderRadius: 4, width: '90%' }} />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DJDirectoryScreen() {
  const [djs, setDjs]             = useState<DJProfile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [genre, setGenre]         = useState('All');
  const [selectedDJ, setSelectedDJ] = useState<DJProfile | null>(null);
  const [directoryTab, setDirectoryTab] = useState<'djs' | 'venues'>('djs');

  const fetchDJs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let query = supabase
      .from('dj_directory')
      .select('*')
      .order('mix_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (genre !== 'All') query = query.eq('genre', genre);

    if (search.trim()) {
      query = query.or(
        `dj_name.ilike.%${search}%,bio.ilike.%${search}%,location.ilike.%${search}%`
      );
    }

    const { data, error } = await query.limit(50);
    if (!error && data) setDjs(data as DJProfile[]);

    setLoading(false);
    setRefreshing(false);
  }, [search, genre]);

  useEffect(() => { fetchDJs(); }, [fetchDJs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchDJs(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const renderItem = ({ item }: { item: DJProfile }) => (
    <DJCard dj={item} onPress={() => setSelectedDJ(item)} />
  );

  return (
    <SafeAreaView style={d.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={d.header}>
        <View>
          <Text style={d.eyebrow}>Cuerate</Text>
          <Text style={d.title}>Directory</Text>
        </View>
      </View>

      {/* DJs / Venues toggle */}
      <View style={d.toggle}>
        <TouchableOpacity
          style={[d.toggleBtn, directoryTab === 'djs' && d.toggleBtnActive]}
          onPress={() => setDirectoryTab('djs')}
        >
          <Ionicons name="people-outline" size={15} color={directoryTab === 'djs' ? C.accent : C.textSec} />
          <Text style={[d.toggleText, directoryTab === 'djs' && d.toggleTextActive]}>DJs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[d.toggleBtn, directoryTab === 'venues' && d.toggleBtnActive]}
          onPress={() => setDirectoryTab('venues')}
        >
          <Ionicons name="business-outline" size={15} color={directoryTab === 'venues' ? C.accent : C.textSec} />
          <Text style={[d.toggleText, directoryTab === 'venues' && d.toggleTextActive]}>Venues</Text>
        </TouchableOpacity>
      </View>

      {directoryTab === 'djs' && (
        <>
      {/* Search bar */}
      <View style={d.searchBar}>
        <Ionicons name="search-outline" size={16} color={C.textMuted} />
        <TextInput
          style={d.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search DJs, locations, genres…"
          placeholderTextColor={C.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Genre filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={d.genreScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      >
        {GENRES.map(g => (
          <TouchableOpacity
            key={g}
            style={[d.genrePill, genre === g && d.genrePillActive]}
            onPress={() => setGenre(g)}
          >
            <Text style={[d.genrePillText, genre === g && d.genrePillTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* DJ grid */}
      {loading ? (
        <View style={d.grid}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : djs.length === 0 ? (
        <View style={d.emptyState}>
          <Ionicons name="people-outline" size={48} color={C.textMuted} />
          <Text style={d.emptyTitle}>
            {search || genre !== 'All' ? 'No DJs match your search' : 'No DJs yet'}
          </Text>
          <Text style={d.emptyBody}>
            {search || genre !== 'All'
              ? 'Try a different search or genre'
              : 'Be the first — make your profile public in Settings'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={djs}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 10 }}
          onRefresh={() => fetchDJs(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}

        </>
      )}

      {directoryTab === 'venues' && <VenueDirectoryScreen />}

      {/* DJ profile modal */}
      {selectedDJ && (
        <DJProfileModal
          dj={selectedDJ}
          onClose={() => setSelectedDJ(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_WIDTH = '48%';

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  headerMeta: { alignItems: 'flex-end', paddingBottom: 4 },
  djCount: { fontSize: 12, color: C.textMuted },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  genreScroll: { marginBottom: 4 },
  genrePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: 'transparent' },
  genrePillActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  genrePillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  genrePillTextActive: { color: C.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingTop: 12 },
  // Card
  card: { width: CARD_WIDTH, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTop: { position: 'relative' },
  avatar: { width: '100%', height: 120, resizeMode: 'cover' },
  avatarPlaceholder: { width: '100%', height: 120, backgroundColor: C.accentDim + '30', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '700', color: C.accent },
  genreBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(10,10,12,0.85)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  genreBadgeText: { fontSize: 10, fontWeight: '600', color: C.textSec },
  cardBody: { padding: 10 },
  djName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 5 },
  locationText: { fontSize: 11, color: C.textMuted, flex: 1 },
  bio: { fontSize: 11, color: C.textSec, lineHeight: 15, marginBottom: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statVal: { fontSize: 13, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted },
  bookingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: C.success + '12', borderWidth: 1, borderColor: C.success + '33' },
  bookingBadgeText: { fontSize: 9, fontWeight: '600', color: C.success },
  toggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginHorizontal: 16, marginBottom: 12, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: C.raised },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  toggleTextActive: { color: C.accent },
  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
});
