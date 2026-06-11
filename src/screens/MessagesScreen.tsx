import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import ConversationScreen from './ConversationScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
  critical: '#FF4D4D',
};

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  otherName: string;
  lastMessage: string | null;
  unread: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  onClose: () => void;
  // If provided, jump straight into a conversation with this user
  openWithUserId?: string;
  openWithUserName?: string;
}

export default function MessagesScreen({ onClose, openWithUserId, openWithUserName }: Props) {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<{ id: string; name: string } | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (!convs || convs.length === 0) { setLoading(false); return; }

    const otherIds = convs.map((c: any) =>
      c.participant_1 === user.id ? c.participant_2 : c.participant_1
    );
    const uniqueIds = [...new Set(otherIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, dj_name')
      .in('id', uniqueIds);
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.dj_name ?? 'DJ']));

    // Fetch last message + unread count for each conversation
    const enriched = await Promise.all(convs.map(async (c: any) => {
      const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
      const [lastMsgRes, unreadRes] = await Promise.all([
        supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', user.id)
          .is('read_at', null),
      ]);
      return {
        ...c,
        otherName: profileMap[otherId] ?? 'DJ',
        lastMessage: lastMsgRes.data?.content ?? null,
        unread: unreadRes.count ?? 0,
      } as Conversation;
    }));

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // If openWithUserId provided, find or create conversation and open it
  useEffect(() => {
    if (!openWithUserId || !user) return;
    async function openDirect() {
      const p1 = user!.id < openWithUserId! ? user!.id : openWithUserId!;
      const p2 = user!.id < openWithUserId! ? openWithUserId! : user!.id;

      let { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1', p1)
        .eq('participant_2', p2)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ participant_1: p1, participant_2: p2 })
          .select('id')
          .single();
        existing = created;
      }

      if (existing) {
        setActiveConv({ id: existing.id, name: openWithUserName ?? 'DJ' });
      }
    }
    openDirect();
  }, [openWithUserId, user]);

  if (activeConv) {
    return (
      <ConversationScreen
        conversationId={activeConv.id}
        otherName={activeConv.name}
        onBack={() => { setActiveConv(null); loadConversations(); }}
      />
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={C.textSec} />
        </TouchableOpacity>
      </View>

      {!user ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyTitle}>Sign in to message DJs</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 60 }} />
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptySub}>Message a DJ from their profile to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => setActiveConv({ id: item.id, name: item.otherName })}
              activeOpacity={0.7}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.otherName[0]?.toUpperCase()}</Text>
              </View>
              <View style={s.rowContent}>
                <View style={s.rowTop}>
                  <Text style={[s.name, item.unread > 0 && s.nameBold]}>{item.otherName}</Text>
                  <Text style={s.time}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <View style={s.rowBottom}>
                  <Text style={[s.preview, item.unread > 0 && s.previewBold]} numberOfLines={1}>
                    {item.lastMessage ?? 'Start a conversation'}
                  </Text>
                  {item.unread > 0 && (
                    <View style={s.unreadBadge}>
                      <Text style={s.unreadText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.accentDim + '50',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.accent },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '600', color: C.text },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: C.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { fontSize: 13, color: C.textSec, flex: 1 },
  previewBold: { color: C.text, fontWeight: '500' },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  sep: { height: 1, backgroundColor: C.border, marginLeft: 74 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 20 },
});
