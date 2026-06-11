import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { sendPushNotification } from '../lib/notifications';
import * as Haptics from 'expo-haptics';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface Props {
  conversationId: string;
  otherName: string;
  onBack: () => void;
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationScreen({ conversationId, otherName, onBack }: Props) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setLoading(false);
    // Mark messages as read
    if (user) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);
    }
  }, [conversationId, user]);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading]);

  async function sendMessage() {
    if (!input.trim() || !user || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Insert message + update conversation timestamp in parallel
    const [, , convRes, profileRes] = await Promise.all([
      supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      }),
      supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId),
      supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .eq('id', conversationId)
        .single(),
      supabase.from('profiles').select('dj_name').eq('id', user.id).single(),
    ]);

    const conv = convRes.data;
    if (conv) {
      const recipientId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
      const senderName = profileRes.data?.dj_name ?? 'Someone';
      sendPushNotification(recipientId, `New message from ${senderName}`, content, { screen: 'messages', conversationId });
    }

    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMsg = messages[index - 1];
    const showTime = !prevMsg ||
      new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={s.timeLabel}>{timeLabel(item.created_at)}</Text>
        )}
        <View style={[s.msgRow, isOwn && s.msgRowOwn]}>
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
            <Text style={[s.bubbleText, isOwn && s.bubbleTextOwn]}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>{otherName[0]?.toUpperCase()}</Text>
        </View>
        <Text style={s.headerName} numberOfLines={1}>{otherName}</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={s.messageList}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={40} color={C.textMuted} />
              <Text style={s.emptyText}>Say hello to {otherName}</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: { padding: 2 },
  headerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.accentDim + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 13, fontWeight: '700', color: C.accent },
  headerName: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1 },
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  timeLabel: { textAlign: 'center', fontSize: 11, color: C.textMuted, marginVertical: 10 },
  msgRow: { flexDirection: 'row', marginBottom: 4 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleOther: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleOwn: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: C.text, lineHeight: 21 },
  bubbleTextOwn: { color: '#fff' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, color: C.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1, backgroundColor: C.raised, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: C.text, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
