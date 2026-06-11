import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import VenueProfileModal from './VenueProfileModal';
import AddVenueModal from './AddVenueModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  info: '#4DB8FF', gold: '#F0C040',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

export interface Venue {
  id: string;
  owner_id: string | null;
  name: string;
  city: string;
  country: string;
  address: string | null;
  capacity: number | null;
  description: string | null;
  website_url: string | null;
  booking_email: string | null;
  instagram_url: string | null;
  gear_provided: string | null;
  has_pioneer: boolean;
  has_denon: boolean;
  has_allen_heath: boolean;
  photo_url: string | null;
  is_verified: boolean;
  review_count: number;
  avg_rating: number | null;
  avg_pay: number | null;
  avg_gear: number | null;
  avg_booth: number | null;
  avg_vibe: number | null;
  created_at: string;
}

// ─── Star display ─────────────────────────────────────────────────────────────

export function StarRow({ rating, size = 12 }: { rating: number | null; size?: number }) {
  if (!rating) return null;
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {[...Array(full)].map((_, i)  => <Ionicons key={`f${i}`} name="star" size={size} color={C.gold} />)}
      {half                          && <Ionicons name="star-half" size={size} color={C.gold} />}
      {[...Array(empty)].map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={size} color={C.textMuted} />)}
    </View>
  );
}

// ─── Gear badges ──────────────────────────────────────────────────────────────

export function GearBadges({ venue }: { venue: Venue }) {
  const badges = [];
  if (venue.has_pioneer)     badges.push({ label: 'Pioneer',      col: '#E8A0C8' });
  if (venue.has_denon)       badges.push({ label: 'Denon',        col: '#4DB8FF' });
  if (venue.has_allen_heath) badges.push({ label: 'Allen & Heath',col: '#4DCC8F' });
  if (!badges.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {badges.map(b => (
        <View key={b.label} style={[v.gearBadge, { backgroundColor: b.col + '18', borderColor: b.col + '44' }]}>
          <Text style={[v.gearBadgeText, { color: b.col }]}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, onPress }: { venue: Venue; onPress: () => void }) {
  const initial = venue.name[0].toUpperCase();
  return (
    <TouchableOpacity style={v.card} onPress={onPress} activeOpacity={0.8}>
      {/* Photo / placeholder */}
      <View style={v.cardTop}>
        {venue.photo_url ? (
          <Image source={{ uri: venue.photo_url }} style={v.photo} />
        ) : (
          <View style={v.photoPlaceholder}>
            <Text style={v.photoInitial}>{initial}</Text>
          </View>
        )}
        {venue.is_verified && (
          <View style={v.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={12} color={C.success} />
            <Text style={v.verifiedText}>Verified</Text>
          </View>
        )}
        {venue.capacity && (
          <View style={v.capacityBadge}>
            <Text style={v.capacityText}>{venue.capacity < 1000 ? venue.capacity : `${(venue.capacity/1000).toFixed(1)}k`}</Text>
          </View>
        )}
      </View>

      <View style={v.cardBody}>
        <Text style={v.venueName} numberOfLines={1}>{venue.name}</Text>
        <View style={v.locationRow}>
          <Ionicons name="location-outline" size={11} color={C.textMuted} />
          <Text style={v.locationText}>{venue.city}</Text>
        </View>

        {/* Rating row */}
        {venue.avg_rating ? (
          <View style={v.ratingRow}>
            <StarRow rating={venue.avg_rating} />
            <Text style={v.ratingVal}>{venue.avg_rating}</Text>
            <Text style={v.reviewCount}>({venue.review_count})</Text>
          </View>
        ) : (
          <Text style={v.noReviews}>No reviews yet</Text>
        )}

        <GearBadges venue={venue} />
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={[v.card, { opacity: 0.4 }]}>
      <View style={v.photoPlaceholder} />
      <View style={v.cardBody}>
        <View style={{ height: 14, backgroundColor: C.raised, borderRadius: 4, width: '65%', marginBottom: 8 }} />
        <View style={{ height: 11, backgroundColor: C.raised, borderRadius: 4, width: '40%' }} />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VenueDirectoryScreen() {
  const [venues, setVenues]         = useState<Venue[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [showAddVenue, setShowAddVenue]   = useState(false);
  const { user } = useAuthStore();

  const fetchVenues = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let query = supabase
      .from('venue_directory')
      .select('*')
      .order('review_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(50);
    if (!error && data) setVenues(data as Venue[]);
    setLoading(false);
    setRefreshing(false);
  }, [search]);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  useEffect(() => {
    const t = setTimeout(() => fetchVenues(), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <View style={{ flex: 1 }}>
      {/* Search + Add */}
      <View style={v.searchRow}>
        <View style={v.searchBar}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={v.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search venues, cities…"
            placeholderTextColor={C.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {user && (
          <TouchableOpacity style={v.addBtn} onPress={() => setShowAddVenue(true)}>
            <Ionicons name="add" size={18} color={C.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Count */}
      <Text style={v.countText}>{loading ? '…' : `${venues.length} venue${venues.length !== 1 ? 's' : ''}`}</Text>

      {loading ? (
        <View style={v.grid}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : venues.length === 0 ? (
        <View style={v.emptyState}>
          <Ionicons name="business-outline" size={48} color={C.textMuted} />
          <Text style={v.emptyTitle}>{search ? 'No venues match' : 'No venues yet'}</Text>
          <Text style={v.emptyBody}>
            {search ? 'Try a different search' : 'Be the first to add a venue to the database'}
          </Text>
          {user && !search && (
            <TouchableOpacity style={v.addVenueBtn} onPress={() => setShowAddVenue(true)}>
              <Ionicons name="add-circle-outline" size={16} color={C.accent} />
              <Text style={v.addVenueBtnText}>Add a venue</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={venues}
          renderItem={({ item }) => (
            <VenueCard venue={item} onPress={() => setSelectedVenue(item)} />
          )}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 10 }}
          onRefresh={() => fetchVenues(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedVenue && (
        <VenueProfileModal
          venue={selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onReviewSubmitted={() => fetchVenues()}
        />
      )}
      {showAddVenue && (
        <AddVenueModal
          onClose={() => setShowAddVenue(false)}
          onSuccess={() => { setShowAddVenue(false); fetchVenues(); }}
        />
      )}
    </View>
  );
}

const v = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  addBtn: { width: 44, height: 44, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, color: C.textMuted, paddingHorizontal: 16, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  card: { width: '48%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTop: { position: 'relative' },
  photo: { width: '100%', height: 110, resizeMode: 'cover' },
  photoPlaceholder: { width: '100%', height: 110, backgroundColor: C.accentDim + '25', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 40, fontWeight: '700', color: C.accent + '80' },
  verifiedBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(10,10,12,0.85)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  verifiedText: { fontSize: 9, fontWeight: '700', color: C.success },
  capacityBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(10,10,12,0.85)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  capacityText: { fontSize: 10, fontWeight: '600', color: C.textSec },
  cardBody: { padding: 10, gap: 5 },
  venueName: { fontSize: 14, fontWeight: '700', color: C.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 11, color: C.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingVal: { fontSize: 12, fontWeight: '700', color: C.gold },
  reviewCount: { fontSize: 11, color: C.textMuted },
  noReviews: { fontSize: 11, color: C.textMuted, fontStyle: 'italic' },
  gearBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  gearBadgeText: { fontSize: 9, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  addVenueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  addVenueBtnText: { fontSize: 14, color: C.accent, fontWeight: '600' },
});
