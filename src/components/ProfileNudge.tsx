import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

const C = {
  accent: '#7C5CFC', accentDim: '#3D2E8A',
  warning: '#F5A623', warningBg: '#1F1508',
  border: '#2A2A38', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Props {
  onPress: () => void;
}

export default function ProfileNudge({ onPress }: Props) {
  const { profile } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!profile) return null;
  // Only show for DJs and venue accounts
  if (profile.account_type === 'fan') return null;

  const missing: string[] = [];
  if (!profile.bio?.trim()) missing.push('bio');
  if (!profile.genre?.trim() && profile.account_type !== 'venue') missing.push('genre');
  if (!profile.location?.trim()) missing.push('location');
  if (profile.account_type !== 'venue' && !profile.soundcloud_url?.trim()) missing.push('SoundCloud link');

  // Profile is complete enough — don't show
  if (missing.length === 0) return null;

  const missingText = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;

  return (
    <TouchableOpacity style={s.banner} onPress={onPress} activeOpacity={0.85}>
      <View style={s.iconWrap}>
        <Ionicons name="person-circle-outline" size={22} color={C.warning} />
      </View>
      <View style={s.textWrap}>
        <Text style={s.title}>Complete your profile</Text>
        <Text style={s.body}>Add your {missingText} to get discovered and improve your For You feed.</Text>
      </View>
      <View style={s.actions}>
        <TouchableOpacity onPress={e => { e.stopPropagation(); setDismissed(true); }} hitSlop={12}>
          <Ionicons name="close" size={16} color={C.textMuted} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color={C.warning} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: C.warningBg,
    borderWidth: 1,
    borderColor: C.warning + '40',
    borderRadius: 12,
    padding: 14,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.warning + '20',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  body: { fontSize: 12, color: C.textSec, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
});
