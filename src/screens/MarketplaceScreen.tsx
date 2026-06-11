import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import ListingDetailModal from './ListingDetailModal';
import CreateListingModal from './CreateListingModal';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  info: '#4DB8FF', gold: '#F0C040',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type Condition = 'mint' | 'excellent' | 'good' | 'fair' | 'spares';

export interface GearListing {
  id: string;
  seller_id: string;
  gear_id: string;
  brand: string;
  model: string;
  category: string;
  price: number;           // pence
  condition: Condition;
  description: string | null;
  location: string | null;
  photo_urls: string[] | null;
  includes: string | null;
  status: string;
  contact_method: string;
  contact_value: string | null;
  view_count: number;
  created_at: string;
  seller_name: string | null;
  seller_avatar: string | null;
  seller_location: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPrice(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const CONDITION_LABELS: Record<Condition, string> = {
  mint: 'Mint', excellent: 'Excellent', good: 'Good', fair: 'Fair', spares: 'Spares/Repair',
};

export const CONDITION_COLORS: Record<Condition, string> = {
  mint: '#4DCC8F', excellent: '#4DB8FF', good: '#7C5CFC', fair: '#F5A623', spares: '#FF4D4D',
};

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Controllers', value: 'controller' },
  { label: 'CDJs', value: 'cdj' },
  { label: 'Mixers', value: 'mixer' },
  { label: 'Speakers', value: 'speaker' },
  { label: 'Headphones', value: 'headphones' },
  { label: 'Laptops', value: 'laptop' },
  { label: 'Amps', value: 'amplifier' },
];

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, onPress }: { listing: GearListing; onPress: () => void }) {
  const condCol = CONDITION_COLORS[listing.condition];
  const hasPhoto = listing.photo_urls && listing.photo_urls.length > 0;
  const initial = listing.brand[0].toUpperCase();

  return (
    <TouchableOpacity style={m.card} onPress={onPress} activeOpacity={0.8}>
      {/* Photo / placeholder */}
      <View style={m.cardPhoto}>
        {hasPhoto ? (
          <Image source={{ uri: listing.photo_urls![0] }} style={m.photo} />
        ) : (
          <View style={m.photoPlaceholder}>
            <Text style={m.photoInitial}>{initial}</Text>
          </View>
        )}
        {/* Condition badge */}
        <View style={[m.condBadge, { backgroundColor: condCol + '22', borderColor: condCol + '55' }]}>
          <Text style={[m.condBadgeText, { color: condCol }]}>{CONDITION_LABELS[listing.condition]}</Text>
        </View>
      </View>

      <View style={m.cardBody}>
        {/* Brand / model */}
        <Text style={m.brand}>{listing.brand}</Text>
        <Text style={m.model} numberOfLines={1}>{listing.model}</Text>

        {/* Price */}
        <Text style={m.price}>{formatPrice(listing.price)}</Text>

        {/* Location + time */}
        <View style={m.metaRow}>
          {listing.location && (
            <>
              <Ionicons name="location-outline" size={10} color={C.textMuted} />
              <Text style={m.metaText} numberOfLines={1}>{listing.location}</Text>
            </>
          )}
        </View>

        {/* Seller */}
        <View style={m.sellerRow}>
          {listing.seller_avatar ? (
            <Image source={{ uri: listing.seller_avatar }} style={m.sellerAvatar} />
          ) : (
            <View style={m.sellerAvatarPlaceholder}>
              <Text style={m.sellerAvatarText}>{(listing.seller_name ?? 'D')[0].toUpperCase()}</Text>
            </View>
          )}
          <Text style={m.sellerName} numberOfLines={1}>{listing.seller_name ?? 'DJ'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={[m.card, { opacity: 0.35 }]}>
      <View style={m.photoPlaceholder} />
      <View style={m.cardBody}>
        <View style={{ height: 10, backgroundColor: C.raised, borderRadius: 3, width: '50%', marginBottom: 6 }} />
        <View style={{ height: 14, backgroundColor: C.raised, borderRadius: 3, width: '80%', marginBottom: 8 }} />
        <View style={{ height: 16, backgroundColor: C.raised, borderRadius: 3, width: '40%' }} />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const [listings, setListings]     = useState<GearListing[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('');
  const [selected, setSelected]     = useState<GearListing | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useAuthStore();

  const fetchListings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let query = supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search.trim()) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(60);
    if (!error && data) setListings(data as GearListing[]);
    setLoading(false);
    setRefreshing(false);
  }, [search, category]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    const t = setTimeout(() => fetchListings(), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Search + sell button */}
      <View style={m.searchRow}>
        <View style={m.searchBar}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={m.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search gear…"
            placeholderTextColor={C.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {user && (
          <TouchableOpacity style={m.sellBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={m.sellBtnText}>Sell</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 8 }}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.value}
            style={[m.catPill, category === cat.value && m.catPillActive]}
            onPress={() => setCategory(cat.value)}
          >
            <Text style={[m.catPillText, category === cat.value && m.catPillTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={m.countText}>
        {loading ? '…' : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}
      </Text>

      {/* Grid */}
      {loading ? (
        <View style={m.grid}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : listings.length === 0 ? (
        <View style={m.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color={C.textMuted} />
          <Text style={m.emptyTitle}>{search || category ? 'No listings match' : 'No listings yet'}</Text>
          <Text style={m.emptyBody}>
            {search || category
              ? 'Try a different search or category'
              : 'Be the first to list your gear for sale'}
          </Text>
          {user && !search && !category && (
            <TouchableOpacity style={m.createBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add-circle-outline" size={16} color={C.accent} />
              <Text style={m.createBtnText}>List your gear</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => setSelected(item)} />
          )}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 10 }}
          onRefresh={() => fetchListings(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selected && (
        <ListingDetailModal
          listing={selected}
          onClose={() => setSelected(null)}
          onStatusChange={() => { setSelected(null); fetchListings(); }}
        />
      )}
      {showCreate && (
        <CreateListingModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchListings(); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, marginBottom: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, height: 44 },
  sellBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  catPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: 'transparent' },
  catPillActive: { backgroundColor: C.accentDim + '33', borderColor: C.accent },
  catPillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  catPillTextActive: { color: C.accent },
  countText: { fontSize: 12, color: C.textMuted, paddingHorizontal: 16, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  card: { width: '48%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardPhoto: { position: 'relative' },
  photo: { width: '100%', height: 110, resizeMode: 'cover' },
  photoPlaceholder: { width: '100%', height: 110, backgroundColor: C.accentDim + '20', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 40, fontWeight: '700', color: C.accent + '60' },
  condBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  condBadgeText: { fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 10 },
  brand: { fontSize: 10, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  model: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '800', color: C.accent, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  metaText: { fontSize: 10, color: C.textMuted, flex: 1 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sellerAvatar: { width: 18, height: 18, borderRadius: 9 },
  sellerAvatarPlaceholder: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.accentDim + '50', alignItems: 'center', justifyContent: 'center' },
  sellerAvatarText: { fontSize: 8, fontWeight: '700', color: C.accent },
  sellerName: { fontSize: 10, color: C.textMuted, flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  createBtnText: { fontSize: 14, color: C.accent, fontWeight: '600' },
});
