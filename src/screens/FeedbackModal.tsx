import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', critical: '#FF4D4D', warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const TYPES = [
  { id: 'bug',  label: '🐛 Bug report',   desc: 'Something is broken or not working' },
  { id: 'idea', label: '💡 Feature idea',  desc: 'Something you\'d like to see added' },
  { id: 'other',label: '💬 General',       desc: 'Anything else on your mind' },
] as const;

const AREAS = ['Hardware', 'Mixes', 'Prepare', 'Directory', 'Gigs', 'Sets', 'Messaging', 'Profile', 'Onboarding', 'Other'];

interface Props {
  onClose: () => void;
}

export default function FeedbackModal({ onClose }: Props) {
  const { user } = useAuthStore();
  const [type, setType]       = useState<'bug' | 'idea' | 'other' | ''>('');
  const [area, setArea]       = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit() {
    if (!type || !message.trim()) {
      Alert.alert('Required', 'Please select a type and write your feedback.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('beta_feedback').insert({
        user_id:  user?.id ?? null,
        type,
        message:  message.trim(),
        app_area: area || null,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send feedback.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 }]}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={C.success} />
          </View>
          <Text style={s.successTitle}>Thanks for the feedback!</Text>
          <Text style={s.successSub}>Every message helps make Cuerate better. We read everything.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <Text style={s.title}>Send feedback</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>
            You're using a private beta. Your feedback shapes what gets built next.
          </Text>

          {/* Type */}
          <Text style={s.sectionLabel}>What kind of feedback?</Text>
          <View style={s.typeList}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.typeCard, type === t.id && s.typeCardActive]}
                onPress={() => setType(t.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.typeLabel, type === t.id && s.typeLabelActive]}>{t.label}</Text>
                <Text style={s.typeDesc}>{t.desc}</Text>
                {type === t.id && (
                  <View style={s.typeCheck}>
                    <Ionicons name="checkmark-circle" size={18} color={C.accent} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* App area */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Which part of the app? (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              {AREAS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[s.areaPill, area === a && s.areaPillActive]}
                  onPress={() => setArea(area === a ? '' : a)}
                >
                  <Text style={[s.areaPillText, area === a && s.areaPillTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Message */}
          <Text style={s.sectionLabel}>Your feedback</Text>
          <TextInput
            style={s.messageField}
            value={message}
            onChangeText={setMessage}
            placeholder={
              type === 'bug' ? 'Describe what happened and how to reproduce it...'
              : type === 'idea' ? 'What would you like to see and why?'
              : 'What\'s on your mind?'
            }
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{message.length}/1000</Text>

          <TouchableOpacity
            style={[s.submitBtn, (!type || !message.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!type || !message.trim() || loading}
          >
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={s.submitBtnText}>{loading ? 'Sending…' : 'Send feedback'}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  intro: { fontSize: 13, color: C.textSec, lineHeight: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  typeList: { gap: 8 },
  typeCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 14, position: 'relative' },
  typeCardActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  typeLabel: { fontSize: 15, fontWeight: '700', color: C.textSec, marginBottom: 2 },
  typeLabelActive: { color: C.text },
  typeDesc: { fontSize: 12, color: C.textMuted },
  typeCheck: { position: 'absolute', top: 14, right: 14 },
  areaPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  areaPillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  areaPillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  areaPillTextActive: { color: C.accent },
  messageField: { backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 14, color: C.text, minHeight: 120 },
  charCount: { fontSize: 11, color: C.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 20 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  successIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.success + '15', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  successSub: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 21 },
  doneBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
