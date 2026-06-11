import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Image, Linking, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Venue, StarRow, GearBadges } from './VenueDirectoryScreen';
import AddVenueReviewModal from './AddVenueReviewModal';
import ApplyForGigModal, { BookingRequest } from './ApplyForGigModal';
import EditVenueModal from './EditVenueModal';
import VenueClaimModal from './VenueClaimModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  info: '#4DB8FF', gold: '#F0C040',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Review {
  id: string;
  reviewer_id: string;
  rating_pay: number | null;
  rating_gear: number | null;
  rating_booth: number | null;
  rating_vibe: number | null;
  overall_rating: number | null;
  review_text: string | null;
  played_date: string | null;
  created_at: string;
  profiles?: { dj_name: string | null; avatar_url: string | null };
}

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  const pct = (value / 5) * 100;
  const col = value >= 4 ? C.success : value >= 3 ? C.warning : C.critical;
  return (
    <View style={p.ratingBarRow}>
      <Text style={p.ratingBarLabel}>{label}</Text>
      <View style={p.ratingBarTrack}>
        <View style={[p.ratingBarFill, { width: `${pct}%` as any, backgroundColor: col }]} />
      </View>
      <Text style={[p.ratingBarVal, { color: col }]}>{value}</Text>
    </View>
  );
}

interface VenueProfileModalProps {
  venue: Venue;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export default function VenueProfileModal({ venue: initialVenue, onClose, onReviewSubmitted }: VenueProfileModalProps) {
  const [venue, setVenue]               = useState(initialVenue);
  const [reviews, setReviews]           = useState<Review[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [userReview, setUserReview]     = useState<Review | null>(null);
  const [gigSlots, setGigSlots]         = useState<BookingRequest[]>([]);
  const [appliedIds, setAppliedIds]     = useState<Set<string>>(new Set());
  const [applyTarget, setApplyTarget]   = useState<BookingRequest | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const { user, profile } = useAuthStore();
  const isVenueAccount = profile?.is_venue === true;
  const isOwner = !!user && venue.owner_id === user.id;
  const canClaim = !!user && isVenueAccount && !venue.owner_id && !isOwner;

  const initial = venue.name[0].toUpperCase();

  useEffect(() => { fetchReviews(); fetchGigSlots(); }, [venue.id]);

  async function fetchGigSlots() {
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('venue_id', venue.id)
      .eq('status', 'open')
      .order('date', { ascending: true });
    setGigSlots((data ?? []) as BookingRequest[]);

    if (user && data && data.length > 0) {
      const ids = data.map((r: any) => r.id);
      const { data: apps } = await supabase
        .from('booking_applications')
        .select('request_id')
        .eq('dj_id', user.id)
        .in('request_id', ids);
      setAppliedIds(new Set((apps ?? []).map((a: any) => a.request_id)));
    }
  }

  async function fetchReviews() {
    setLoading(true);
    const { data } = await supabase
      .from('venue_reviews')
      .select('*, profiles:reviewer_id(dj_name, avatar_url)')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false });
    if (data) {
      setReviews(data as Review[]);
      if (user) {
        setUserReview(data.find((r: Review) => r.reviewer_id === user.id) ?? null);
      }
    }
    setLoading(false);
  }

  const timeAgo = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={p.topBar}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isOwner && (
              <TouchableOpacity style={p.reviewBtn} onPress={() => setShowEditModal(true)}>
                <Ionicons name="pencil-outline" size={14} color={C.accent} />
                <Text style={p.reviewBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {canClaim && (
              <TouchableOpacity style={[p.reviewBtn, { borderColor: C.success + '60', backgroundColor: C.success + '10' }]} onPress={() => setShowClaimModal(true)}>
                <Ionicons name="flag-outline" size={14} color={C.success} />
                <Text style={[p.reviewBtnText, { color: C.success }]}>Claim venue</Text>
              </TouchableOpacity>
            )}
            {user && !userReview && !isOwner && (
              <TouchableOpacity style={p.reviewBtn} onPress={() => setShowReviewModal(true)}>
                <Ionicons name="star-outline" size={14} color={C.accent} />
                <Text style={p.reviewBtnText}>Write a review</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={p.hero}>
            {venue.photo_url ? (
              <Image source={{ uri: venue.photo_url }} style={p.heroPhoto} />
            ) : (
              <View style={p.heroPlaceholder}>
                <Text style={p.heroInitial}>{initial}</Text>
              </View>
            )}
            <View style={p.heroInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={p.heroName}>{venue.name}</Text>
                {venue.is_verified && (
                  <Ionicons name="checkmark-circle" size={18} color={C.success} />
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={13} color={C.textMuted} />
                <Text style={p.heroCity}>{venue.city}, {venue.country}</Text>
              </View>
              {venue.capacity && (
                <Text style={p.heroCap}>Capacity: ~{venue.capacity.toLocaleString()}</Text>
              )}
              {isOwner && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={C.accent} />
                  <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>Your venue</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ padding: 16, gap: 16 }}>
            {/* Overall rating */}
            {venue.avg_rating ? (
              <View style={p.card}>
                <Text style={p.cardTitle}>Overall rating</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Text style={p.bigRating}>{venue.avg_rating}</Text>
                  <View>
                    <StarRow rating={venue.avg_rating} size={16} />
                    <Text style={p.reviewCountText}>{venue.review_count} review{venue.review_count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <RatingBar label="Pay reliability" value={venue.avg_pay} />
                <RatingBar label="Gear quality"    value={venue.avg_gear} />
                <RatingBar label="Booth setup"     value={venue.avg_booth} />
                <RatingBar label="Vibe / crowd"    value={venue.avg_vibe} />
              </View>
            ) : (
              <View style={[p.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Ionicons name="star-outline" size={32} color={C.textMuted} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, marginTop: 8 }}>No reviews yet</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
                  Be the first DJ to review this venue
                </Text>
                {user && (
                  <TouchableOpacity style={[p.reviewBtn, { marginTop: 14 }]} onPress={() => setShowReviewModal(true)}>
                    <Ionicons name="star-outline" size={14} color={C.accent} />
                    <Text style={p.reviewBtnText}>Write a review</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* About */}
            {venue.description ? (
              <View style={p.card}>
                <Text style={p.cardTitle}>About</Text>
                <Text style={p.bodyText}>{venue.description}</Text>
              </View>
            ) : null}

            {/* Gear */}
            {(venue.gear_provided || venue.has_pioneer || venue.has_denon || venue.has_allen_heath) ? (
              <View style={p.card}>
                <Text style={p.cardTitle}>Equipment provided</Text>
                <GearBadges venue={venue} />
                {venue.gear_provided ? (
                  <Text style={[p.bodyText, { marginTop: 8 }]}>{venue.gear_provided}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Contact */}
            {(venue.website_url || venue.booking_email || venue.instagram_url) ? (
              <View style={p.card}>
                <Text style={p.cardTitle}>Contact</Text>
                {venue.website_url && (
                  <TouchableOpacity style={p.linkRow} onPress={() => Linking.openURL(venue.website_url!)}>
                    <Ionicons name="globe-outline" size={16} color={C.accent} />
                    <Text style={p.linkText}>Website</Text>
                  </TouchableOpacity>
                )}
                {venue.booking_email && (
                  <TouchableOpacity style={p.linkRow} onPress={() => Linking.openURL(`mailto:${venue.booking_email}`)}>
                    <Ionicons name="mail-outline" size={16} color={C.accent} />
                    <Text style={p.linkText}>{venue.booking_email}</Text>
                  </TouchableOpacity>
                )}
                {venue.instagram_url && (
                  <TouchableOpacity style={p.linkRow} onPress={() => Linking.openURL(venue.instagram_url!)}>
                    <Ionicons name="logo-instagram" size={16} color={C.accent} />
                    <Text style={p.linkText}>Instagram</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Open gig slots */}
            {gigSlots.length > 0 && (
              <View style={p.card}>
                <Text style={p.cardTitle}>Open gig slots</Text>
                {gigSlots.map(slot => {
                  const applied = appliedIds.has(slot.id);
                  const feeStr = slot.fee_min || slot.fee_max
                    ? `£${slot.fee_min ? (slot.fee_min / 100).toLocaleString('en-GB') : '?'} – £${slot.fee_max ? (slot.fee_max / 100).toLocaleString('en-GB') : '?'}`
                    : null;
                  return (
                    <View key={slot.id} style={p.gigSlot}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={p.gigDate}>{slot.date}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          {slot.genre && (
                            <View style={p.gigBadge}>
                              <Text style={p.gigBadgeText}>{slot.genre}</Text>
                            </View>
                          )}
                          {feeStr && (
                            <View style={[p.gigBadge, { borderColor: C.success + '44', backgroundColor: C.success + '12' }]}>
                              <Text style={[p.gigBadgeText, { color: C.success }]}>{feeStr}</Text>
                            </View>
                          )}
                        </View>
                        {slot.description ? (
                          <Text style={p.gigDesc} numberOfLines={2}>{slot.description}</Text>
                        ) : null}
                      </View>
                      {!isVenueAccount && user && (
                        <TouchableOpacity
                          style={[p.applyBtn, applied && p.applyBtnDone]}
                          onPress={() => !applied && setApplyTarget(slot)}
                          disabled={applied}
                        >
                          <Text style={[p.applyBtnText, applied && { color: C.success }]}>
                            {applied ? '✓ Applied' : 'Apply'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Reviews */}
            <View style={p.card}>
              <Text style={p.cardTitle}>DJ Reviews</Text>
              {loading ? (
                <ActivityIndicator color={C.accent} />
              ) : reviews.length === 0 ? (
                <Text style={{ fontSize: 13, color: C.textMuted }}>No reviews yet.</Text>
              ) : (
                reviews.map(r => (
                  <View key={r.id} style={p.reviewCard}>
                    <View style={p.reviewHeader}>
                      <View style={p.reviewerAvatar}>
                        {r.profiles?.avatar_url ? (
                          <Image source={{ uri: r.profiles.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                        ) : (
                          <Text style={p.reviewerInitial}>
                            {(r.profiles?.dj_name ?? 'DJ')[0].toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={p.reviewerName}>{r.profiles?.dj_name ?? 'Anonymous DJ'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <StarRow rating={r.overall_rating} size={11} />
                          {r.played_date && <Text style={p.playedDate}>{r.played_date}</Text>}
                          <Text style={p.reviewTime}>{timeAgo(r.created_at)}</Text>
                        </View>
                      </View>
                      {r.reviewer_id === user?.id && (
                        <TouchableOpacity onPress={() => Alert.alert('Delete review', 'Remove your review?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: async () => {
                            await supabase.from('venue_reviews').delete().eq('id', r.id);
                            fetchReviews();
                            onReviewSubmitted();
                          }},
                        ])}>
                          <Ionicons name="trash-outline" size={16} color={C.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Category ratings */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {[
                        { label: 'Pay',   val: r.rating_pay },
                        { label: 'Gear',  val: r.rating_gear },
                        { label: 'Booth', val: r.rating_booth },
                        { label: 'Vibe',  val: r.rating_vibe },
                      ].filter(x => x.val).map(x => {
                        const col = x.val! >= 4 ? C.success : x.val! >= 3 ? C.warning : C.critical;
                        return (
                          <View key={x.label} style={[p.ratingChip, { backgroundColor: col + '18', borderColor: col + '33' }]}>
                            <Text style={[p.ratingChipText, { color: col }]}>{x.label} {x.val}/5</Text>
                          </View>
                        );
                      })}
                    </View>

                    {r.review_text ? (
                      <Text style={p.reviewText}>{r.review_text}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>

        {showClaimModal && (
          <VenueClaimModal
            venue={venue}
            onClose={() => setShowClaimModal(false)}
            onSuccess={() => {
              setShowClaimModal(false);
              Alert.alert('Claim submitted', 'A Cuerate admin will review your request within 48 hours.');
            }}
          />
        )}

        {showEditModal && (
          <EditVenueModal
            venue={venue}
            onClose={() => setShowEditModal(false)}
            onSuccess={(updated) => { setVenue(updated); setShowEditModal(false); onReviewSubmitted(); }}
          />
        )}

        {showReviewModal && (
          <AddVenueReviewModal
            venue={venue}
            onClose={() => setShowReviewModal(false)}
            onSuccess={() => {
              setShowReviewModal(false);
              fetchReviews();
              onReviewSubmitted();
            }}
          />
        )}

        {applyTarget && (
          <ApplyForGigModal
            request={applyTarget}
            onClose={() => setApplyTarget(null)}
            onSuccess={() => {
              setApplyTarget(null);
              setAppliedIds(prev => new Set([...prev, applyTarget.id]));
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const p = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  reviewBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  heroPhoto: { width: 80, height: 80, borderRadius: 12, resizeMode: 'cover' },
  heroPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: C.accentDim + '30', alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontSize: 36, fontWeight: '700', color: C.accent + '80' },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { fontSize: 20, fontWeight: '700', color: C.text },
  heroCity: { fontSize: 13, color: C.textMuted },
  heroCap: { fontSize: 12, color: C.textMuted },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  bigRating: { fontSize: 40, fontWeight: '800', color: C.gold },
  reviewCountText: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  ratingBarLabel: { fontSize: 12, color: C.textSec, width: 100 },
  ratingBarTrack: { flex: 1, height: 4, backgroundColor: C.raised, borderRadius: 2, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 2 },
  ratingBarVal: { fontSize: 12, fontWeight: '700', width: 20, textAlign: 'right' },
  bodyText: { fontSize: 13, color: C.textSec, lineHeight: 19 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  linkText: { fontSize: 14, color: C.accent },
  reviewCard: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reviewerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.accentDim + '40', alignItems: 'center', justifyContent: 'center' },
  reviewerInitial: { fontSize: 14, fontWeight: '700', color: C.accent },
  reviewerName: { fontSize: 13, fontWeight: '600', color: C.text },
  playedDate: { fontSize: 11, color: C.textMuted },
  reviewTime: { fontSize: 11, color: C.textMuted },
  ratingChip: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  ratingChipText: { fontSize: 10, fontWeight: '700' },
  reviewText: { fontSize: 13, color: C.textSec, lineHeight: 18, marginTop: 8 },
  gigSlot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  gigDate: { fontSize: 14, fontWeight: '700', color: C.text },
  gigBadge: { borderRadius: 6, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20', paddingHorizontal: 8, paddingVertical: 3 },
  gigBadgeText: { fontSize: 11, fontWeight: '600', color: C.accent },
  gigDesc: { fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 2 },
  applyBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  applyBtnDone: { backgroundColor: C.success + '18', borderWidth: 1, borderColor: C.success + '44' },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
