import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import GigsScreen from './GigsScreen';
import GigCalendarScreen from './GigCalendarScreen';
import GigCalculatorScreen from './GigCalculatorScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', border: '#2A2A38',
  accent: '#7C5CFC', text: '#F0EFF8', textMuted: '#52516A',
};

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'calc', label: 'Calculator' },
];

type Tab = 'browse' | 'calendar' | 'calc';

export default function GigsHubScreen() {
  const [active, setActive] = useState<Tab>('browse');

  return (
    <View style={s.root}>
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, active === t.id && s.tabActive]}
            onPress={() => setActive(t.id as Tab)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabLabel, active === t.id && s.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {active === 'browse' && <GigsScreen />}
        {active === 'calendar' && <GigCalendarScreen />}
        {active === 'calc' && <GigCalculatorScreen />}
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
