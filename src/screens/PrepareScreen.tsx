import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SetBuilderScreen from './SetBuilderScreen';
import USBRealityCheckScreen from './USBRealityCheckScreen';
import BpmTapperScreen from './BpmTapperScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', border: '#2A2A38',
  accent: '#7C5CFC', text: '#F0EFF8', textMuted: '#52516A',
};

const TABS = [
  { id: 'sets', label: 'Set Builder' },
  { id: 'usb', label: 'USB Check' },
  { id: 'bpm', label: 'BPM Tap' },
];

export default function PrepareScreen() {
  const [active, setActive] = useState<'sets' | 'usb' | 'bpm'>('sets');

  return (
    <View style={s.root}>
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, active === t.id && s.tabActive]}
            onPress={() => setActive(t.id as any)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabLabel, active === t.id && s.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {active === 'sets' ? <SetBuilderScreen /> : active === 'usb' ? <USBRealityCheckScreen /> : <BpmTapperScreen />}
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
