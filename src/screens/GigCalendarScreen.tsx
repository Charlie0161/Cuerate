import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import AddGigModal from './AddGigModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', critical: '#FF4D4D', criticalBg: '#1F0E0E',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Gig {
  id: string;
  venue_name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  fee: number | null;
  notes: string | null;
  source: string;
}

function formatFee(pence: number) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function GigCalendarScreen() {
  const { user, session } = useAuthStore();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const loadGigs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('dj_gigs')
      .select('*')
      .eq('dj_id', user.id)
      .order('date', { ascending: true });
    setGigs((data as Gig[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (user) loadGigs().finally(() => setLoading(false));
    else setLoading(false);
  }, [user, loadGigs]);

  async function deleteGig(id: string) {
    Alert.alert('Remove gig', 'Remove this gig from your calendar?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('dj_gigs').delete().eq('id', id);
          setGigs(prev => prev.filter(g => g.id !== id));
        },
      },
    ]);
  }

  // Build marked dates for calendar
  const markedDates: Record<string, any> = {};
  gigs.forEach(g => {
    markedDates[g.date] = {
      marked: true,
      dotColor: C.accent,
      ...(g.date === selectedDate ? { selected: true, selectedColor: C.accentDim } : {}),
    };
  });
  if (selectedDate && !markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: C.accentDim };
  }

  const gigsForSelected = selectedDate ? gigs.filter(g => g.date === selectedDate) : [];
  const upcomingGigs = gigs.filter(g => g.date >= today);
  const pastGigs = gigs.filter(g => g.date < today);

  if (!session) {
    return (
      <View style={s.center}>
        <Ionicons name="calendar-outline" size={40} color={C.textMuted} />
        <Text style={s.emptyTitle}>Sign in to use your gig calendar</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Calendar
        current={today}
        onDayPress={(day: any) => setSelectedDate(day.dateString === selectedDate ? '' : day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: C.bg,
          calendarBackground: C.surface,
          textSectionTitleColor: C.textMuted,
          selectedDayBackgroundColor: C.accentDim,
          selectedDayTextColor: C.accent,
          todayTextColor: C.accent,
          dayTextColor: C.text,
          textDisabledColor: C.textMuted,
          dotColor: C.accent,
          selectedDotColor: C.accent,
          arrowColor: C.accent,
          monthTextColor: C.text,
          indicatorColor: C.accent,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={s.calendar}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Add gig button */}
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={16} color={C.accent} />
          <Text style={s.addBtnText}>
            {selectedDate ? `Add gig on ${new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Add a gig'}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="small" color={C.accent} style={{ marginTop: 20 }} />
        ) : selectedDate ? (
          // Selected date view
          <>
            <Text style={s.sectionLabel}>{formatDate(selectedDate)}</Text>
            {gigsForSelected.length === 0 ? (
              <Text style={s.noGigs}>No gigs on this date.</Text>
            ) : gigsForSelected.map(g => <GigCard key={g.id} gig={g} onDelete={deleteGig} />)}
          </>
        ) : (
          // Default: upcoming + past
          <>
            {upcomingGigs.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Upcoming gigs</Text>
                {upcomingGigs.map(g => <GigCard key={g.id} gig={g} onDelete={deleteGig} />)}
              </>
            )}
            {pastGigs.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 20 }]}>Past gigs</Text>
                {pastGigs.slice(-5).reverse().map(g => (
                  <GigCard key={g.id} gig={g} onDelete={deleteGig} past />
                ))}
              </>
            )}
            {gigs.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="calendar-outline" size={40} color={C.textMuted} />
                <Text style={s.emptyTitle}>No gigs yet</Text>
                <Text style={s.emptySub}>Tap "Add a gig" to log your first booking.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showAddModal && (
        <AddGigModal
          initialDate={selectedDate || undefined}
          onClose={() => setShowAddModal(false)}
          onSuccess={(date) => {
            setShowAddModal(false);
            setSelectedDate(date);
            loadGigs();
          }}
        />
      )}
    </View>
  );
}

function GigCard({ gig, onDelete, past }: { gig: Gig; onDelete: (id: string) => void; past?: boolean }) {
  return (
    <View style={[s.gigCard, past && s.gigCardPast]}>
      <View style={s.gigCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.gigVenue, past && { color: C.textSec }]}>{gig.venue_name}</Text>
          <View style={s.gigMeta}>
            {gig.start_time && (
              <>
                <Ionicons name="time-outline" size={11} color={C.textMuted} />
                <Text style={s.gigMetaText}>{gig.start_time}</Text>
              </>
            )}
            {gig.location && (
              <>
                {gig.start_time && <Text style={s.gigMetaDot}>·</Text>}
                <Ionicons name="location-outline" size={11} color={C.textMuted} />
                <Text style={s.gigMetaText}>{gig.location}</Text>
              </>
            )}
          </View>
          {!past && (
            <Text style={s.gigDate}>{formatDate(gig.date)}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {gig.fee !== null && (
            <Text style={s.gigFee}>{formatFee(gig.fee)}</Text>
          )}
          <TouchableOpacity onPress={() => onDelete(gig.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={15} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      {gig.notes && (
        <Text style={s.gigNotes}>{gig.notes}</Text>
      )}
      {gig.source === 'booking' && (
        <View style={s.bookedBadge}>
          <Ionicons name="checkmark-circle" size={11} color={C.success} />
          <Text style={s.bookedBadgeText}>Booked via Cuerate</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  calendar: { borderBottomWidth: 1, borderBottomColor: C.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 10, padding: 12, marginBottom: 20 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: C.accent },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  noGigs: { fontSize: 13, color: C.textMuted },
  gigCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  gigCardPast: { opacity: 0.6 },
  gigCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  gigVenue: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  gigMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  gigMetaText: { fontSize: 12, color: C.textMuted },
  gigMetaDot: { fontSize: 12, color: C.textMuted },
  gigDate: { fontSize: 12, color: C.accent, marginTop: 4, fontWeight: '600' },
  gigFee: { fontSize: 15, fontWeight: '700', color: C.success },
  gigNotes: { fontSize: 13, color: C.textSec, lineHeight: 18, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  bookedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  bookedBadgeText: { fontSize: 11, color: C.success, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
});
