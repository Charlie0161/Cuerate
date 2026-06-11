import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', success: '#4DCC8F',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const REASONS = [
  { id: 'spam',         label: 'Spam or fake account' },
  { id: 'harassment',  label: 'Harassment or abuse' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'impersonation', label: 'Impersonating someone' },
  { id: 'other',        label: 'Something else' },
];

interface Props {
  reportedId: string;
  reportedName: string;
  reporterId: string;
  onClose: () => void;
}

export default function ReportUserModal({ reportedId, reportedName, reporterId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      Alert.alert('Select a reason', 'Please choose a reason for the report.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: reporterId,
        reported_id: reportedId,
        reason,
        details: details.trim() || null,
      });
      if (error) {
        // 23505 = already reported
        if (error.code === '23505') {
          Alert.alert('Already reported', 'You have already reported this user.');
          onClose();
          return;
        }
        throw error;
      }
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not submit report.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 }]}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={52} color={C.success} />
          </View>
          <Text style={s.successTitle}>Report submitted</Text>
          <Text style={s.successSub}>We'll review this and take action if needed. Thanks for keeping Cuerate safe.</Text>
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
          <Text style={s.title}>Report {reportedName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>Reports are anonymous and reviewed by the Cuerate team.</Text>

          <Text style={s.sectionLabel}>Reason</Text>
          <View style={s.reasonList}>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[s.reasonRow, reason === r.id && s.reasonRowActive]}
                onPress={() => setReason(r.id)}
              >
                <View style={[s.radio, reason === r.id && s.radioActive]}>
                  {reason === r.id && <View style={s.radioDot} />}
                </View>
                <Text style={[s.reasonText, reason === r.id && { color: C.text }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Additional details <Text style={{ color: C.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
          <TextInput
            style={s.detailsField}
            value={details}
            onChangeText={setDetails}
            placeholder="Any extra context that might help..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[s.submitBtn, (!reason || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!reason || loading}
          >
            <Ionicons name="flag" size={15} color="#fff" />
            <Text style={s.submitBtnText}>{loading ? 'Submitting…' : 'Submit report'}</Text>
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
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  intro: { fontSize: 13, color: C.textSec, lineHeight: 19, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  reasonList: { gap: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 14 },
  reasonRowActive: { borderColor: C.critical, backgroundColor: C.critical + '10' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: C.critical },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.critical },
  reasonText: { fontSize: 14, color: C.textSec, fontWeight: '500' },
  detailsField: { backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 14, color: C.text, minHeight: 100, marginBottom: 20 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.critical, borderRadius: 12, paddingVertical: 14 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.success + '15', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  successSub: { fontSize: 14, color: C.textSec, textAlign: 'center', lineHeight: 20 },
  doneBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
