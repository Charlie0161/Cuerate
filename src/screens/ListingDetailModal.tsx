import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  GearListing, formatPrice, CONDITION_LABELS, CONDITION_COLORS,
} from './MarketplaceScreen';
import { GEAR_DATABASE, getBuyLinks } from '../data/gearDatabase';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const CATEGORY_LABELS: Record<string, string> = {
  controller: 'DJ Controller', mixer: 'Mixer', cdj: 'CDJ / Standalone',
  speaker: 'Speaker', subwoofer: 'Subwoofer', headphones: 'Headphones',
  laptop: 'Laptop', amplifier: 'Amplifier',
};

interface ListingDetailModalProps {
  listing: GearListing;
  onClose: () => void;
  onStatusChange: () => void;
}

export default function ListingDetailModal({ listing, onClose, onStatusChange }: ListingDetailModalProps) {
  const { user } = useAuthStore();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [marking, setMarking] = useState(false);
  const isOwner = user?.id === listing.seller_id;
  const buyLinks = getBuyLinks(listing.brand, listing.model);
  const condCol = CONDITION_COLORS[listing.condition];
  const photos = listing.photo_urls ?? [];

  const timeAgo = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  async function markAsSold() {
    Alert.alert('Mark as sold', 'Remove this listing from the marketplace?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark sold', style: 'destructive', onPress: async () => {
        setMarking(true);
        await supabase.from('gear_listings').update({ status: 'sold' }).eq('id', listing.id);
        setMarking(false);
        onStatusChange();
      }},
    ]);
  }

  async function deleteListing() {
    Alert.alert('Delete listing', 'Permanently delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('gear_listings').delete().eq('id', listing.id);
        onStatusChange();
      }},
    ]);
  }

  function handleContact() {
    if (listing.contact_method === 'email' && listing.contact_value) {
      Linking.openURL(`mailto:${listing.contact_value}?subject=Re: ${listing.brand} ${listing.model} on Cuerate`);
    } else if (listing.contact_method === 'whatsapp' && listing.contact_value) {
      const msg = encodeURIComponent(`Hi, I'm interested in your ${listing.brand} ${listing.model} listed on Cuerate for ${formatPrice(listing.price)}`);
      Linking.openURL(`https://wa.me/${listing.contact_value.replace(/\D/g, '')}?text=${msg}`);
    } else {
      Alert.alert('Contact seller', `Message the seller through Cuerate.\n\nSeller: ${listing.seller_name ?? 'DJ'}`);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={l.topBar}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
          {isOwner && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={markAsSold} disabled={marking}>
                <Text style={{ fontSize: 13, color: C.warning, fontWeight: '600' }}>
                  {marking ? 'Updating…' : 'Mark sold'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteListing}>
                <Ionicons name="trash-outline" size={20} color={C.critical} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo gallery */}
          {photos.length > 0 ? (
            <View>
              <Image source={{ uri: photos[photoIdx] }} style={l.mainPhoto} resizeMode="cover" />
              {photos.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
                  {photos.map((url, i) => (
                    <TouchableOpacity key={i} onPress={() => setPhotoIdx(i)}>
                      <Image source={{ uri: url }} style={[l.thumb, photoIdx === i && l.thumbActive]} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={l.photoPlaceholder}>
              <Ionicons name="hardware-chip-outline" size={56} color={C.accent + '50'} />
            </View>
          )}

          <View style={{ padding: 16 }}>
            {/* Title + price */}
            <View style={l.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={l.brand}>{listing.brand}</Text>
                <Text style={l.model}>{listing.model}</Text>
                <Text style={l.category}>{CATEGORY_LABELS[listing.category] ?? listing.category}</Text>
              </View>
              <Text style={l.price}>{formatPrice(listing.price)}</Text>
            </View>

            {/* Condition + location */}
            <View style={l.tagsRow}>
              <View style={[l.tag, { backgroundColor: condCol + '18', borderColor: condCol + '44' }]}>
                <Text style={[l.tagText, { color: condCol }]}>{CONDITION_LABELS[listing.condition]}</Text>
              </View>
              {listing.location && (
                <View style={l.tag}>
                  <Ionicons name="location-outline" size={11} color={C.textMuted} />
                  <Text style={l.tagText}>{listing.location}</Text>
                </View>
              )}
              <View style={l.tag}>
                <Ionicons name="time-outline" size={11} color={C.textMuted} />
                <Text style={l.tagText}>{timeAgo(listing.created_at)}</Text>
              </View>
            </View>

            {/* Description */}
            {listing.description ? (
              <View style={l.card}>
                <Text style={l.cardTitle}>Description</Text>
                <Text style={l.bodyText}>{listing.description}</Text>
              </View>
            ) : null}

            {/* Includes */}
            {listing.includes ? (
              <View style={l.card}>
                <Text style={l.cardTitle}>Includes</Text>
                <Text style={l.bodyText}>{listing.includes}</Text>
              </View>
            ) : null}

            {/* Seller */}
            <View style={l.card}>
              <Text style={l.cardTitle}>Seller</Text>
              <View style={l.sellerRow}>
                {listing.seller_avatar ? (
                  <Image source={{ uri: listing.seller_avatar }} style={l.sellerAvatar} />
                ) : (
                  <View style={l.sellerAvatarPlaceholder}>
                    <Text style={l.sellerInitial}>{(listing.seller_name ?? 'D')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={l.sellerName}>{listing.seller_name ?? 'Anonymous DJ'}</Text>
                  {listing.seller_location && (
                    <Text style={l.sellerLocation}>{listing.seller_location}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Contact button */}
            {!isOwner && (
              <TouchableOpacity style={l.contactBtn} onPress={handleContact}>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                <Text style={l.contactBtnText}>Contact seller</Text>
              </TouchableOpacity>
            )}

            {/* Buy new */}
            <View style={l.buyNewSection}>
              <Text style={l.buyNewLabel}>Buy brand new</Text>
              <View style={l.buyNewRow}>
                {Object.entries(buyLinks).map(([retailer, url]) => (
                  <TouchableOpacity key={retailer} style={l.buyNewBtn} onPress={() => Linking.openURL(url)}>
                    <Text style={l.buyNewBtnText}>{retailer.charAt(0).toUpperCase() + retailer.slice(1)}</Text>
                    <Ionicons name="open-outline" size={11} color={C.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Views */}
            <Text style={l.viewCount}>{listing.view_count} views</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const l = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  mainPhoto: { width: '100%', height: 260 },
  photoPlaceholder: { width: '100%', height: 200, backgroundColor: C.accentDim + '15', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: C.accent },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  brand: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  model: { fontSize: 22, fontWeight: '800', color: C.text, marginTop: 2 },
  category: { fontSize: 12, color: C.textSec, marginTop: 3 },
  price: { fontSize: 26, fontWeight: '800', color: C.accent },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  tagText: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  bodyText: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22 },
  sellerAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentDim + '40', alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { fontSize: 18, fontWeight: '700', color: C.accent },
  sellerName: { fontSize: 15, fontWeight: '600', color: C.text },
  sellerLocation: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  contactBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  buyNewSection: { marginBottom: 16 },
  buyNewLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  buyNewRow: { flexDirection: 'row', gap: 8 },
  buyNewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 11 },
  buyNewBtnText: { fontSize: 13, fontWeight: '600', color: C.textSec },
  viewCount: { fontSize: 11, color: C.textMuted, textAlign: 'center' },
});
