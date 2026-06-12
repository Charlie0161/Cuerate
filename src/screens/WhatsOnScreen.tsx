import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Linking,
  Image, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { containsProfanity } from '../lib/profanity';

const TICKETMASTER_KEY = 'AozPym31hIsQKtnXvBNMqGjRXbUR8tUE';
// ─── Get your free key at skiddle.com/api ────────────────────────────────────
const SKIDDLE_KEY = 'b3eed285c7f315c14bb19b50990fb381';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const GENRES = ['All', 'House', 'Techno', 'Drum & Bass', 'UK Garage', 'Trance', 'Hip-Hop', 'Afrobeats', 'Jungle', 'Disco'];

interface LocalEvent {
  id: string;
  title: string;
  artist: string | null;
  venue_name: string;
  location: string;
  date: string;
  time: string | null;
  genre: string | null;
  price_from: number | null;
  ticket_url: string | null;
  image_url: string | null;
  description: string | null;
  posted_by: string;
  source: 'local';
  profiles?: { dj_name: string | null };
}

interface ExternalEvent {
  id: string;
  title: string;
  artist: string | null;
  venue_name: string;
  location: string;
  date: string;
  time: string | null;
  genre: string | null;
  price_from: number | null;
  ticket_url: string | null;
  image_url: string | null;
  description: string | null;
  source: 'ticketmaster' | 'skiddle';
}

// Keep alias so existing code compiles unchanged
type TMEvent = ExternalEvent;

type Event = LocalEvent | ExternalEvent;

// ─── Post Event Modal ─────────────────────────────────────────────────────────
function PostEventModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [genre, setGenre] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setError('Event title is required.'); return; }
    if (containsProfanity(title) || containsProfanity(description)) { setError('Your text contains language that isn\'t allowed.'); return; }
    if (!venueName.trim()) { setError('Venue name is required.'); return; }
    if (!location.trim()) { setError('Location is required (city, country).'); return; }
    if (!date.trim()) { setError('Date is required (YYYY-MM-DD).'); return; }
    if (!user) return;

    // Basic date format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Date must be in YYYY-MM-DD format, e.g. 2025-08-15');
      return;
    }

    // Validate ticket URL if provided
    if (ticketUrl.trim() && !ticketUrl.trim().startsWith('http')) {
      setError('Ticket URL must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: dbErr } = await supabase.from('events').insert({
      title: title.trim(),
      artist: artist.trim() || null,
      venue_name: venueName.trim(),
      location: location.trim(),
      date: date.trim(),
      time: time.trim() || null,
      genre: genre || null,
      ticket_url: ticketUrl.trim() || null,
      description: description.trim() || null,
      posted_by: user.id,
    });
    setSubmitting(false);
    if (dbErr) { setError('Failed to post event — try again.'); return; }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={pm.root}>
        <View style={pm.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
          <Text style={pm.headerTitle}>Post an event</Text>
          <TouchableOpacity style={[pm.postBtn, submitting && { opacity: 0.4 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={pm.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={pm.body} keyboardShouldPersistTaps="handled">
          <Field label="Event title *" value={title} onChange={setTitle} placeholder="e.g. Silva Bumpa b2b Seth Troxler" />
          <Field label="Headliner / Artist" value={artist} onChange={setArtist} placeholder="Main DJ or act" />
          <Field label="Venue *" value={venueName} onChange={setVenueName} placeholder="e.g. Papaya Beach Club" />
          <Field label="Location *" value={location} onChange={setLocation} placeholder="e.g. Zante, Greece" />
          <Field label="Date * (YYYY-MM-DD)" value={date} onChange={setDate} placeholder="2025-08-15" keyboardType="numbers-and-punctuation" />
          <Field label="Time (e.g. 22:00)" value={time} onChange={setTime} placeholder="22:00" keyboardType="numbers-and-punctuation" />
          <Field label="Ticket URL" value={ticketUrl} onChange={setTicketUrl} placeholder="https://dice.fm/..." autoCapitalize="none" autoCorrect={false} />
          <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Lineup, door times, vibe…" multiline />

          <Text style={pm.label}>Genre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pm.genreScroll}>
            {GENRES.filter(g => g !== 'All').map(g => (
              <TouchableOpacity
                key={g}
                style={[pm.genrePill, genre === g && pm.genrePillActive]}
                onPress={() => setGenre(genre === g ? '' : g)}
              >
                <Text style={[pm.genrePillText, genre === g && { color: C.accent }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {error && <Text style={pm.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType, autoCapitalize, autoCorrect,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: any; autoCapitalize?: any; autoCorrect?: boolean;
}) {
  return (
    <>
      <Text style={pm.label}>{label}</Text>
      <TextInput
        style={[pm.input, multiline && pm.textarea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={autoCorrect ?? true}
      />
    </>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: Event }) {
  const dateObj = new Date(event.date);
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const year = dateObj.getFullYear();

  return (
    <TouchableOpacity
      style={ec.card}
      activeOpacity={event.ticket_url ? 0.75 : 1}
      onPress={() => event.ticket_url && Linking.openURL(event.ticket_url)}
    >
      {/* Date strip */}
      <View style={ec.dateBadge}>
        <Text style={ec.dayName}>{dayName.toUpperCase()}</Text>
        <Text style={ec.dayNum}>{dayNum}</Text>
        <Text style={ec.year}>{year}</Text>
      </View>

      <View style={ec.body}>
        <View style={ec.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={ec.title} numberOfLines={2}>{event.title}</Text>
            {event.artist && event.artist !== event.title && (
              <Text style={ec.artist} numberOfLines={1}>{event.artist}</Text>
            )}
          </View>
          {event.source === 'ticketmaster' && (
            <View style={ec.tmBadge}>
              <Text style={ec.tmText}>TM</Text>
            </View>
          )}
          {event.source === 'skiddle' && (
            <View style={[ec.tmBadge, { backgroundColor: '#E8174A' }]}>
              <Text style={ec.tmText}>SK</Text>
            </View>
          )}
        </View>

        <View style={ec.metaRow}>
          <Ionicons name="location-outline" size={12} color={C.textMuted} />
          <Text style={ec.metaText}>{event.venue_name}{event.location ? ` · ${event.location}` : ''}</Text>
        </View>

        {event.time && (
          <View style={ec.metaRow}>
            <Ionicons name="time-outline" size={12} color={C.textMuted} />
            <Text style={ec.metaText}>{event.time}</Text>
          </View>
        )}

        <View style={ec.footer}>
          {event.genre ? (
            <View style={ec.genrePill}>
              <Text style={ec.genrePillText}>{event.genre}</Text>
            </View>
          ) : <View />}

          {event.price_from != null ? (
            <Text style={ec.price}>From £{(event.price_from / 100).toFixed(0)}</Text>
          ) : event.ticket_url ? (
            <View style={ec.ticketBtn}>
              <Ionicons name="ticket-outline" size={12} color={C.accent} />
              <Text style={ec.ticketBtnText}>Get tickets</Text>
            </View>
          ) : null}
        </View>

        {event.description ? (
          <Text style={ec.description} numberOfLines={2}>{event.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Ticketmaster fetch ───────────────────────────────────────────────────────
async function fetchTicketmasterEvents(
  cityQuery: string,
  genreFilter: string,
  artistQuery: string,
  page = 0,
): Promise<{ events: TMEvent[]; totalPages: number }> {
  if (!TICKETMASTER_KEY) return { events: [], totalPages: 0 };
  try {
    const params = new URLSearchParams({
      apikey: TICKETMASTER_KEY,
      classificationName: 'music',
      sort: 'date,asc',
      size: '50',
      page: String(page),
    });
    // keyword covers both artist name and genre text search
    const keyword = [artistQuery.trim(), genreFilter !== 'All' ? genreFilter : ''].filter(Boolean).join(' ');
    if (keyword) params.set('keyword', keyword);
    if (cityQuery.trim()) params.set('city', cityQuery.trim());

    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (!res.ok) return { events: [], totalPages: 0 };
    const json = await res.json();
    const embedded = json._embedded?.events ?? [];
    const totalPages: number = json.page?.totalPages ?? 1;

    const events = embedded.map((e: any): TMEvent => {
      const venue = e._embedded?.venues?.[0];
      const priceRanges = e.priceRanges;
      return {
        id: `tm_${e.id}`,
        title: e.name,
        artist: e._embedded?.attractions?.[0]?.name ?? null,
        venue_name: venue?.name ?? 'TBA',
        location: [venue?.city?.name, venue?.country?.name].filter(Boolean).join(', '),
        date: e.dates?.start?.localDate ?? '',
        time: e.dates?.start?.localTime?.slice(0, 5) ?? null,
        genre: e.classifications?.[0]?.genre?.name ?? null,
        price_from: priceRanges ? Math.round(priceRanges[0].min * 100) : null,
        ticket_url: e.url ?? null,
        image_url: e.images?.find((i: any) => i.ratio === '16_9' && i.width > 500)?.url ?? null,
        description: null,
        source: 'ticketmaster',
      };
    });
    return { events, totalPages };
  } catch {
    return { events: [], totalPages: 0 };
  }
}

// ─── Skiddle fetch ────────────────────────────────────────────────────────────
async function fetchSkiddleEvents(
  townQuery: string,
  artistQuery: string,
  page = 0,
): Promise<{ events: ExternalEvent[]; totalPages: number }> {
  if (!SKIDDLE_KEY) return { events: [], totalPages: 0 };
  try {
    const params = new URLSearchParams({
      api_key: SKIDDLE_KEY,
      // CLUB = club nights, LIVE = live music — both relevant for DJ sets
      eventcode: 'CLUB,LIVE',
      limit: '50',
      offset: String(page * 50),
      order: 'date',
      description: '1',
    });
    if (townQuery.trim()) params.set('town', townQuery.trim());
    if (artistQuery.trim()) params.set('keyword', artistQuery.trim());

    const res = await fetch(`https://www.skiddle.com/api/v1/events/?${params}`);
    if (!res.ok) return { events: [], totalPages: 0 };
    const json = await res.json();
    const results: any[] = json.results ?? [];
    const total: number = json.totalcount ?? results.length;
    const totalPages = Math.ceil(total / 50);

    const events: ExternalEvent[] = results.map((e: any) => ({
      id: `sk_${e.id}`,
      title: e.eventname,
      artist: e.artists?.[0]?.name ?? null,
      venue_name: e.venue?.name ?? 'TBA',
      location: [e.venue?.town, e.venue?.country].filter(Boolean).join(', '),
      date: e.startdate ?? '',
      time: e.openingtimes?.doorsopen ?? null,
      genre: e.genres?.[0]?.name ?? null,
      price_from: e.entryprice ? Math.round(parseFloat(e.entryprice) * 100) : null,
      ticket_url: e.link ?? null,
      image_url: e.imagesmedium ?? null,
      description: e.description ?? null,
      source: 'skiddle' as const,
    }));

    return { events, totalPages };
  } catch {
    return { events: [], totalPages: 0 };
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WhatsOnScreen() {
  const { session, profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tmPage, setTmPage] = useState(0);
  const [tmTotalPages, setTmTotalPages] = useState(1);
  const [skPage, setSkPage] = useState(0);
  const [skTotalPages, setSkTotalPages] = useState(1);

  const [locationInput, setLocationInput] = useState('');
  const [artistInput, setArtistInput] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('All');
  const [showPostModal, setShowPostModal] = useState(false);

  const load = useCallback(async (location: string, artist: string, genre: string) => {
    let q = supabase
      .from('events')
      .select('*, profiles:posted_by(dj_name)')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(100);

    if (location.trim()) q = q.ilike('location', `%${location.trim()}%`);
    if (artist.trim()) q = q.or(`title.ilike.%${artist.trim()}%,artist.ilike.%${artist.trim()}%`);
    if (genre !== 'All') q = q.ilike('genre', `%${genre}%`);

    const [{ data: localData }, { events: tmEvents, totalPages: tmPages }, { events: skEvents, totalPages: skPages }] = await Promise.all([
      q,
      fetchTicketmasterEvents(location, genre, artist, 0),
      fetchSkiddleEvents(location, artist, 0),
    ]);

    setTmPage(0); setTmTotalPages(tmPages);
    setSkPage(0); setSkTotalPages(skPages);

    const local: Event[] = (localData ?? []).map((e: any) => ({ ...e, source: 'local' as const }));
    const all = mergeAndSort(local, [...tmEvents, ...skEvents]);
    setEvents(all);
  }, []);

  async function loadMore() {
    const tmHasMore = tmPage + 1 < tmTotalPages;
    const skHasMore = skPage + 1 < skTotalPages;
    if ((!tmHasMore && !skHasMore) || loadingMore) return;
    setLoadingMore(true);
    const [tmRes, skRes] = await Promise.all([
      tmHasMore ? fetchTicketmasterEvents(locationQuery, genreFilter, artistQuery, tmPage + 1) : Promise.resolve({ events: [], totalPages: tmTotalPages }),
      skHasMore ? fetchSkiddleEvents(locationQuery, artistQuery, skPage + 1) : Promise.resolve({ events: [], totalPages: skTotalPages }),
    ]);
    if (tmHasMore) setTmPage(p => p + 1);
    if (skHasMore) setSkPage(p => p + 1);
    setEvents(prev => mergeAndSort(prev, [...tmRes.events, ...skRes.events]));
    setLoadingMore(false);
  }

  useFocusEffect(useCallback(() => {
    load(locationQuery, artistQuery, genreFilter).finally(() => setLoading(false));
  }, [load, locationQuery, artistQuery, genreFilter]));

  // Debounced inputs
  useEffect(() => {
    const t = setTimeout(() => setLocationQuery(locationInput), 500);
    return () => clearTimeout(t);
  }, [locationInput]);

  useEffect(() => {
    const t = setTimeout(() => setArtistQuery(artistInput), 500);
    return () => clearTimeout(t);
  }, [artistInput]);

  async function onRefresh() {
    setRefreshing(true);
    await load(locationQuery, artistQuery, genreFilter);
    setRefreshing(false);
  }

  const canPost = session && (profile?.account_type === 'venue' || profile?.account_type === 'dj' || profile?.is_admin);

  return (
    <View style={s.root}>
      {/* Search bars */}
      <View style={s.searchRow}>
        <View style={[s.searchBox, { flex: 1 }]}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            value={artistInput}
            onChangeText={setArtistInput}
            placeholder="Search artist or event…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {artistInput.length > 0 && (
            <TouchableOpacity onPress={() => setArtistInput('')}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={[s.searchBox, { flex: 1 }]}>
          <Ionicons name="location-outline" size={16} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            value={locationInput}
            onChangeText={setLocationInput}
            placeholder="City or country…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {locationInput.length > 0 && (
            <TouchableOpacity onPress={() => setLocationInput('')}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Genre pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.genreBar}
        contentContainerStyle={s.genreBarContent}
      >
        {GENRES.map(g => (
          <TouchableOpacity
            key={g}
            style={[s.genrePill, genreFilter === g && s.genrePillActive]}
            onPress={() => setGenreFilter(g)}
          >
            <Text style={[s.genrePillText, genreFilter === g && { color: C.accent }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            events.length > 0 ? (
              <View style={s.resultsHeader}>
                <Text style={s.resultsCount}>{events.length} event{events.length !== 1 ? 's' : ''}</Text>
                {locationQuery ? <Text style={s.resultsLocation}>· {locationQuery}</Text> : null}
                {artistQuery ? <Text style={s.resultsLocation}>· "{artistQuery}"</Text> : null}
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="calendar-outline" size={48} color={C.textMuted} />
              <Text style={s.emptyTitle}>No events found</Text>
              <Text style={s.emptySub}>
                {artistQuery
                  ? `No events found for "${artistQuery}" — try a different name.`
                  : locationQuery
                  ? `Nothing in "${locationQuery}" right now — try another city.`
                  : 'Search an artist or city above, or post an upcoming set.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <EventCard event={item} />}
        />
      )}

      {canPost && (
        <TouchableOpacity style={s.fab} onPress={() => setShowPostModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {showPostModal && (
        <PostEventModal
          onClose={() => setShowPostModal(false)}
          onSuccess={() => {
            setShowPostModal(false);
            load(locationQuery, artistQuery, genreFilter);
          }}
        />
      )}
    </View>
  );
}

function mergeAndSort(local: Event[], tm: TMEvent[]): Event[] {
  const seen = new Set<string>(local.map(e => e.id));
  const merged = [...local];
  for (const e of tm) {
    if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
  }
  return merged.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    if (a.source === 'local' && b.source !== 'local') return -1;
    if (b.source === 'local' && a.source !== 'local') return 1;
    return 0;
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  searchRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  genreBar: { flexGrow: 0, flexShrink: 0 },
  genreBarContent: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  genrePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  genrePillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, minHeight: 300 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  resultsCount: { fontSize: 13, fontWeight: '700', color: C.text },
  resultsLocation: { fontSize: 13, color: C.textMuted },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});

const ec = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, flexDirection: 'row', overflow: 'hidden' },
  dateBadge: { width: 60, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 2 },
  dayName: { fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.5 },
  dayNum: { fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center' },
  year: { fontSize: 10, color: C.textMuted },
  body: { flex: 1, padding: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  artist: { fontSize: 12, color: C.accent, marginTop: 2, fontWeight: '600' },
  tmBadge: { backgroundColor: '#003087', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tmText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  metaText: { fontSize: 12, color: C.textMuted, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  genrePill: { backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  genrePillText: { fontSize: 11, fontWeight: '600', color: C.accent },
  price: { fontSize: 13, fontWeight: '700', color: C.success },
  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ticketBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },
  description: { fontSize: 12, color: C.textSec, marginTop: 6, lineHeight: 17 },
});

const pm = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  postBtn: { backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  body: { padding: 16, gap: 4, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textarea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  genreScroll: { gap: 6, paddingVertical: 2 },
  genrePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  genrePillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  error: { fontSize: 13, color: C.critical, marginTop: 12, textAlign: 'center' },
});
