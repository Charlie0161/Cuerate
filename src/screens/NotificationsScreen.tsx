import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const TYPE_ICON: Record<string, { name: any; color: string }> = {
  application_received: { name: 'person-add-outline',       color: C.accent },
  application_accepted: { name: 'checkmark-circle-outline', color: C.success },
  application_declined: { name: 'close-circle-outline',     color: C.critical },
  new_message:          { name: 'chatbubble-outline',        color: C.accent },
  new_follower:         { name: 'heart-outline',             color: C.warning },
  default:              { name: 'notifications-outline',     color: C.textMuted },
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  onClose?: () => void;
}

export default function NotificationsScreen({ onClose }: Props) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as Notification[]);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
    // Mark all as read when screen opens
    if (user) {
      supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    }
  }, [load, user]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function clearAll() {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        {onClose ? (
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
        <Text style={s.headerTitle}>Notifications</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={clearAll} hitSlop={12}>
            <Text style={s.clearBtn}>Clear all</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="notifications-off-outline" size={48} color={C.textMuted} />
              <Text style={s.emptyTitle}>All caught up</Text>
              <Text style={s.emptySub}>Application updates, follows and messages will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const icon = TYPE_ICON[item.type] ?? TYPE_ICON.default;
            return (
              <View style={[s.row, !item.read && s.rowUnread]}>
                <View style={[s.iconWrap, { backgroundColor: icon.color + '20' }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={s.textWrap}>
                  <Text style={s.title}>{item.title}</Text>
                  <Text style={s.body}>{item.body}</Text>
                  <Text style={s.time}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.read && <View style={s.unreadDot} />}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  clearBtn: { fontSize: 13, color: C.critical, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, minHeight: 300 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  rowUnread: { backgroundColor: C.accent + '08', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 0 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  body: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  time: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 6, flexShrink: 0 },
});
