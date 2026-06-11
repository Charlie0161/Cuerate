import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import MessagesScreen from '../screens/MessagesScreen';

const C = {
  accent: '#7C5CFC', bg: '#0A0A0C', critical: '#FF4D4D',
  text: '#F0EFF8',
};

export default function MessagesButton() {
  const { user } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let cancelled = false;

    async function checkUnread() {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user!.id)
        .is('read_at', null)
        .in('conversation_id',
          (await supabase
            .from('conversations')
            .select('id')
            .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
          ).data?.map((c: any) => c.id) ?? []
        );
      if (!cancelled) setUnread(count ?? 0);
    }

    checkUnread();
    const interval = setInterval(checkUnread, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, showMessages]);

  return (
    <>
      <TouchableOpacity
        style={s.btn}
        onPress={() => setShowMessages(true)}
        hitSlop={8}
      >
        <Ionicons name="chatbubble-outline" size={22} color={C.text} />
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={showMessages} animationType="slide" presentationStyle="pageSheet">
        <MessagesScreen onClose={() => setShowMessages(false)} />
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
