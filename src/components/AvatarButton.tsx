import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Image, View, Text, StyleSheet, Modal } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';

const C = {
  accent: '#7C5CFC', accentDim: '#3D2E8A',
  text: '#F0EFF8', border: '#2A2A38', bg: '#0A0A0C',
  critical: '#FF4D4D',
};

export default function AvatarButton() {
  const { profile, session, user } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user || !profile?.is_venue) { setPendingCount(0); return; }
    let cancelled = false;

    async function checkPending() {
      const { data: slots } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('venue_id', user!.id)
        .eq('status', 'open');
      if (!slots || slots.length === 0 || cancelled) return;
      const { count } = await supabase
        .from('booking_applications')
        .select('id', { count: 'exact', head: true })
        .in('request_id', slots.map(s => s.id))
        .eq('status', 'pending');
      if (!cancelled) setPendingCount(count ?? 0);
    }

    checkPending();
    const interval = setInterval(checkPending, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, profile?.is_venue, showProfile]);

  const avatarUri = profile?.avatar_url ?? profile?.soundcloud_avatar;
  const initials = (profile?.dj_name ?? profile?.email ?? 'DJ').slice(0, 2).toUpperCase();

  return (
    <>
      <TouchableOpacity onPress={() => session ? setShowProfile(true) : setShowAuth(true)}
        style={s.btn} hitSlop={8}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatar} />
        ) : (
          <View style={s.placeholder}>
            <Text style={s.initials}>{session ? initials : '?'}</Text>
          </View>
        )}
        {pendingCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={showProfile} animationType="slide" presentationStyle="pageSheet">
        <ProfileScreen onClose={() => setShowProfile(false)} />
      </Modal>

      <Modal visible={showAuth} animationType="slide" presentationStyle="pageSheet">
        <AuthScreen onClose={() => setShowAuth(false)} />
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { width: 34, height: 34, borderRadius: 17 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.accent },
  placeholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accentDim + '50', borderWidth: 1.5, borderColor: C.accent + '60', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, fontWeight: '700', color: C.accent },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.critical, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
});
