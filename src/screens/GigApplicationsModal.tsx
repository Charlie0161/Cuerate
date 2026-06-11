import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/notifications';
import DJProfileModal from './DJProfileModal';
import type { DJProfile } from './DJDirectoryScreen';
import type { BookingRequest } from './ApplyForGigModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Application {
  id: string;
  request_id: string;
  dj_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  dj_name: string | null;
  avatar_url: string | null;
  genre: string | null;
  booking_email: string | null;
  soundcloud_url: string | null;
}

interface Props {
  request: BookingRequest;
  onClose: () => void;
  onFilled: () => void;
}

export default function GigApplicationsModal({ request, onClose, onFilled }: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<DJProfile | null>(null);

  async function openProfile(app: Application) {
    const { data } = await supabase
      .from('profiles')
      .select('id, dj_name, bio, avatar_url, soundcloud_url, soundcloud_username, genre, location, booking_email, preview_track_url, mix_count, track_count, created_at')
      .eq('id', app.dj_id)
      .single();
    if (data) setViewProfile(data as DJProfile);
  }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('booking_applications')
      .select(`
        id, request_id, dj_id, message, status, created_at,
        profiles:dj_id (dj_name, avatar_url, genre, booking_email, soundcloud_url)
      `)
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    if (data) {
      setApplications(data.map((a: any) => ({
        ...a,
        dj_name: a.profiles?.dj_name ?? null,
        avatar_url: a.profiles?.avatar_url ?? null,
        genre: a.profiles?.genre ?? null,
        booking_email: a.profiles?.booking_email ?? null,
        soundcloud_url: a.profiles?.soundcloud_url ?? null,
      })));
    }
    setLoading(false);
  }, [request.id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(app: Application, newStatus: 'accepted' | 'declined') {
    const action = newStatus === 'accepted' ? 'accept' : 'decline';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} application`,
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${app.dj_name ?? 'this DJ'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus === 'accepted' ? 'Accept' : 'Decline',
          style: newStatus === 'declined' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdating(app.id);
            const { error } = await supabase
              .from('booking_applications')
              .update({ status: newStatus })
              .eq('id', app.id);

            if (error) {
              Alert.alert('Error', error.message);
              setUpdating(null);
              return;
            }

            // Send push notification to DJ
            const notifTitle = newStatus === 'accepted'
              ? `Gig offer from ${request.venue_name}`
              : `Update on your application`;
            const notifBody = newStatus === 'accepted'
              ? `You've been accepted for ${request.date}! Check your booking email.`
              : `Your application for ${request.venue_name} on ${request.date} was not selected.`;
            await sendPushNotification(app.dj_id, notifTitle, notifBody, {
              screen: 'gigs',
              requestId: request.id,
            });

            // If accepted, mark gig as filled
            if (newStatus === 'accepted') {
              await supabase
                .from('booking_requests')
                .update({ status: 'filled' })
                .eq('id', request.id);
              onFilled();
            }

            setApplications(prev => prev.map(a =>
              a.id === app.id ? { ...a, status: newStatus } : a
            ));
            setUpdating(null);
          },
        },
      ]
    );
  }

  const pending = applications.filter(a => a.status === 'pending');
  const decided = applications.filter(a => a.status !== 'pending');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Applications</Text>
            <Text style={s.subtitle}>{request.venue_name} · {request.date}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ flex: 1 }} />
        ) : applications.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="person-outline" size={40} color={C.textMuted} />
            <Text style={s.emptyTitle}>No applications yet</Text>
            <Text style={s.emptySub}>DJs will appear here when they apply.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {pending.length > 0 && (
              <>
                <Text style={s.sectionHeader}>Pending ({pending.length})</Text>
                {pending.map(app => (
                  <AppCard
                    key={app.id}
                    app={app}
                    updating={updating === app.id}
                    onAccept={() => updateStatus(app, 'accepted')}
                    onDecline={() => updateStatus(app, 'declined')}
                    onViewProfile={() => openProfile(app)}
                  />
                ))}
              </>
            )}
            {decided.length > 0 && (
              <>
                <Text style={[s.sectionHeader, { marginTop: 20 }]}>Decided ({decided.length})</Text>
                {decided.map(app => (
                  <AppCard
                    key={app.id}
                    app={app}
                    updating={false}
                    onViewProfile={() => openProfile(app)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {viewProfile && (
        <DJProfileModal
          dj={viewProfile}
          onClose={() => setViewProfile(null)}
        />
      )}
    </Modal>
  );
}

function AppCard({
  app, updating, onAccept, onDecline, onViewProfile,
}: {
  app: Application;
  updating: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onViewProfile: () => void;
}) {
  const initials = app.dj_name?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.cardTop} onPress={onViewProfile} activeOpacity={0.75}>
        {app.avatar_url ? (
          <Image source={{ uri: app.avatar_url }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.djName}>{app.dj_name ?? 'Unknown DJ'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {app.genre ? <Text style={s.meta}>{app.genre}</Text> : null}
            {app.booking_email ? (
              <Text style={s.meta} numberOfLines={1}>{app.booking_email}</Text>
            ) : null}
          </View>
        </View>
        {app.status !== 'pending' ? (
          <View style={[s.statusBadge,
            app.status === 'accepted' ? s.statusAccepted : s.statusDeclined
          ]}>
            <Text style={[s.statusText,
              app.status === 'accepted' ? { color: C.success } : { color: C.critical }
            ]}>
              {app.status === 'accepted' ? 'Accepted' : 'Declined'}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        )}
      </TouchableOpacity>

      <Text style={s.message}>{app.message}</Text>

      {app.soundcloud_url && (
        <View style={s.scRow}>
          <Ionicons name="musical-note-outline" size={13} color={C.textMuted} />
          <Text style={s.scLink} numberOfLines={1}>{app.soundcloud_url}</Text>
        </View>
      )}

      {app.status === 'pending' && (
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.declineBtn, updating && { opacity: 0.5 }]}
            onPress={onDecline}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color={C.critical} />
            ) : (
              <Text style={s.declineBtnText}>Decline</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.acceptBtn, updating && { opacity: 0.5 }]}
            onPress={onAccept}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 13, color: C.textSec, marginTop: 2 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentDim + '50', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '700', color: C.accent },
  djName: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.textMuted },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusAccepted: { backgroundColor: C.success + '15', borderColor: C.success + '50' },
  statusDeclined: { backgroundColor: C.critical + '15', borderColor: C.critical + '50' },
  statusText: { fontSize: 12, fontWeight: '600' },
  message: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  scRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scLink: { fontSize: 12, color: C.textMuted, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: { flex: 1, borderWidth: 1, borderColor: C.critical + '60', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: C.critical },
  acceptBtn: { flex: 1.5, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
