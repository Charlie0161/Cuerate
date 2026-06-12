import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const ROLE_OPTIONS = [
  {
    id: 'dj',
    label: 'DJ',
    icon: 'headset-outline' as const,
    desc: 'Manage your bookings, mixes, gear and sets.',
  },
  {
    id: 'venue',
    label: 'Venue',
    icon: 'business-outline' as const,
    desc: 'Post gig slots and find DJs for your events.',
  },
  {
    id: 'both',
    label: 'Both',
    icon: 'swap-horizontal-outline' as const,
    desc: 'Switch between DJ and venue features freely.',
  },
  {
    id: 'fan',
    label: 'Music Fan',
    icon: 'musical-note-outline' as const,
    desc: 'Follow DJs, discover mixes and submit tracks.',
  },
];

const FEATURES = [
  { icon: 'megaphone-outline' as const,      text: 'Find and apply for gig slots near you' },
  { icon: 'radio-outline' as const,          text: 'Share mixes and discover new sounds' },
  { icon: 'calendar-outline' as const,       text: "See what's on — powered by Ticketmaster & Skiddle" },
  { icon: 'chatbubble-outline' as const,     text: 'Message DJs and venues directly' },
  { icon: 'people-outline' as const,         text: 'Browse the DJ & venue directory' },
  { icon: 'hardware-chip-outline' as const,  text: 'Manage your DJ hardware and gear' },
];

interface Props {
  onDone: (role: string) => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string>('dj');
  const totalPages = 4;

  function goNext() {
    if (page < totalPages - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
      setPage(page + 1);
    } else {
      finish();
    }
  }

  async function finish() {
    await AsyncStorage.setItem('onboarded', '1');
    await AsyncStorage.setItem('onboard_role', selectedRole);
    onDone(selectedRole);
  }

  return (
    <View style={s.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {/* Slide 1: Welcome */}
        <View style={s.slide}>
          <View style={s.logoWrap}>
            <Ionicons name="headset" size={64} color={C.accent} />
          </View>
          <Text style={s.appName}>Cuerate</Text>
          <Text style={s.tagline}>The professional DJ companion</Text>
          <Text style={s.body}>
            Everything you need to manage your DJ career — from bookings and sets
            to gear and gigs — in one place.
          </Text>
        </View>

        {/* Slide 2: Features */}
        <View style={s.slide}>
          <Text style={s.slideTitle}>Everything in one place</Text>
          <Text style={s.slideSubtitle}>Built for working DJs and the venues that book them.</Text>
          <View style={s.featureList}>
            {FEATURES.map((f, i) => (
              <View key={i} style={s.featureRow}>
                <View style={s.featureIconWrap}>
                  <Ionicons name={f.icon} size={18} color={C.accent} />
                </View>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Slide 3: Role picker */}
        <View style={s.slide}>
          <Text style={s.slideTitle}>How are you using Cuerate?</Text>
          <Text style={s.slideSubtitle}>You can always change this later in your profile.</Text>
          <View style={s.roleList}>
            {ROLE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[s.roleCard, selectedRole === r.id && s.roleCardActive]}
                onPress={() => setSelectedRole(r.id)}
                activeOpacity={0.7}
              >
                <View style={[s.roleIconWrap, selectedRole === r.id && s.roleIconWrapActive]}>
                  <Ionicons name={r.icon} size={24} color={selectedRole === r.id ? C.accent : C.textSec} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.roleLabel, selectedRole === r.id && s.roleLabelActive]}>{r.label}</Text>
                  <Text style={s.roleDesc}>{r.desc}</Text>
                </View>
                {selectedRole === r.id && (
                  <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Slide 4: Quick start */}
        <View style={s.slide}>
          <View style={s.logoWrap}>
            <Ionicons name="rocket-outline" size={48} color={C.accent} />
          </View>
          <Text style={s.slideTitle}>You're all set 🎉</Text>
          <Text style={s.slideSubtitle}>Here's what to do first:</Text>
          <View style={s.featureList}>
            {(selectedRole === 'venue' ? [
              { icon: 'person-circle-outline' as const, text: 'Complete your venue profile so DJs can find you' },
              { icon: 'megaphone-outline' as const,     text: 'Post a gig slot to start receiving applications' },
              { icon: 'people-outline' as const,        text: 'Browse the DJ directory to find talent directly' },
              { icon: 'calendar-outline' as const,      text: "Add your upcoming nights to What's On" },
            ] : selectedRole === 'fan' ? [
              { icon: 'radio-outline' as const,         text: 'Explore Mixes — tap For You for personalised picks' },
              { icon: 'people-outline' as const,        text: 'Follow DJs you like in the Directory' },
              { icon: 'calendar-outline' as const,      text: "Check What's On for events near you" },
              { icon: 'musical-note-outline' as const,  text: 'Browse Sets from your favourite festival DJs' },
            ] : [
              { icon: 'person-circle-outline' as const, text: 'Complete your profile — add genre, location and bio' },
              { icon: 'radio-outline' as const,         text: 'Share a mix to get discovered by venues' },
              { icon: 'megaphone-outline' as const,     text: 'Browse Gigs and apply for slots near you' },
              { icon: 'chatbubble-outline' as const,    text: 'Message venues directly from their profile' },
            ]).map((tip, i) => (
              <View key={i} style={s.featureRow}>
                <View style={s.featureIconWrap}>
                  <Ionicons name={tip.icon} size={18} color={C.accent} />
                </View>
                <Text style={s.featureText}>{tip.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Dots */}
      <View style={s.dots}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity style={s.btn} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.btnText}>
            {page === totalPages - 1 ? "Let's go" : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
        {page < totalPages - 1 && (
          <TouchableOpacity onPress={finish} style={s.skipBtn}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logoWrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: C.accentDim + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.accentDim,
  },
  appName: { fontSize: 38, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  tagline: { fontSize: 17, color: C.accent, fontWeight: '600', marginBottom: 20 },
  body: { fontSize: 15, color: C.textSec, lineHeight: 24, textAlign: 'center' },
  slideTitle: { fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  slideSubtitle: { fontSize: 14, color: C.textSec, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  featureList: { width: '100%', gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.accentDim + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: 14, color: C.text, flex: 1, fontWeight: '500' },
  roleList: { width: '100%', gap: 12 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    padding: 16,
  },
  roleCardActive: { borderColor: C.accent, backgroundColor: C.accentDim + '25' },
  roleIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.raised,
    alignItems: 'center', justifyContent: 'center',
  },
  roleIconWrapActive: { backgroundColor: C.accentDim + '50' },
  roleLabel: { fontSize: 16, fontWeight: '700', color: C.textSec, marginBottom: 2 },
  roleLabelActive: { color: C.text },
  roleDesc: { fontSize: 13, color: C.textMuted, lineHeight: 17 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotActive: { width: 20, backgroundColor: C.accent },
  footer: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },
  btn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 14, color: C.textMuted },
});
