import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import NotificationsScreen from '../screens/NotificationsScreen';

const C = { accent: '#7C5CFC', bg: '#0A0A0C', critical: '#FF4D4D', text: '#F0EFF8' };

export default function NotificationsButton() {
  const { user } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [show, setShow] = useState(false);

  const checkUnread = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setUnread(count ?? 0);
  }, [user]);

  useEffect(() => {
    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [checkUnread]);

  // Recheck when modal closes (user may have read them)
  function handleClose() {
    setShow(false);
    checkUnread();
  }

  if (!user) return null;

  return (
    <>
      <TouchableOpacity style={s.btn} onPress={() => setShow(true)} hitSlop={8}>
        <Ionicons name="notifications-outline" size={22} color={C.text} />
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={show} animationType="slide" presentationStyle="pageSheet">
        <NotificationsScreen onClose={handleClose} />
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: C.critical,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.bg,
  },
  badgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },
});
