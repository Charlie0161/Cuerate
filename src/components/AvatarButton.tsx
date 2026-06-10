import React, { useState } from 'react';
import { TouchableOpacity, Image, View, Text, StyleSheet, Modal } from 'react-native';
import { useAuthStore } from '../store/authStore';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';

const C = {
  accent: '#7C5CFC', accentDim: '#3D2E8A',
  text: '#F0EFF8', border: '#2A2A38', bg: '#0A0A0C',
};

export default function AvatarButton() {
  const { profile, session } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

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
});
