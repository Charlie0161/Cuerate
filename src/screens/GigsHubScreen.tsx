import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import GigsScreen from './GigsScreen';
import GigCalendarScreen from './GigCalendarScreen';
import GigCalculatorScreen from './GigCalculatorScreen';
import VenueGigsScreen from './VenueGigsScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', border: '#2A2A38',
  accent: '#7C5CFC', text: '#F0EFF8', textMuted: '#52516A',
};

const DJ_TABS = [
  { id: 'browse', label: 'Browse Gigs' },
  { id: 'calendar', label: 'My Calendar' },
  { id: 'calc', label: 'Calculator' },
];

const VENUE_TABS = [
  { id: 'my-gigs', label: 'My Gigs' },
  { id: 'browse', label: 'Browse' },
];

type DJTab = 'browse' | 'calendar' | 'calc';
type VenueTab = 'my-gigs' | 'browse';

export default function GigsHubScreen() {
  const { profile } = useAuthStore();
  const isVenue = profile?.account_type === 'venue';

  const [djTab, setDjTab] = useState<DJTab>('browse');
  const [venueTab, setVenueTab] = useState<VenueTab>('my-gigs');

  if (isVenue) {
    return (
      <View style={s.root}>
        <View style={s.tabBar}>
          {VENUE_TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, venueTab === t.id && s.tabActive]}
              onPress={() => setVenueTab(t.id as VenueTab)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabLabel, venueTab === t.id && s.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {venueTab === 'my-gigs' && <VenueGigsScreen />}
          {venueTab === 'browse' && <GigsScreen />}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.tabBar}>
        {DJ_TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, djTab === t.id && s.tabActive]}
            onPress={() => setDjTab(t.id as DJTab)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabLabel, djTab === t.id && s.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {djTab === 'browse' && <GigsScreen />}
        {djTab === 'calendar' && <GigCalendarScreen />}
        {djTab === 'calc' && <GigCalculatorScreen />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    gap: 4,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.accent },
  tabLabel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabLabelActive: { color: C.accent },
});
