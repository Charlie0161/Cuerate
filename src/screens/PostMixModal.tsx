import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const GENRES = ['House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other'];

const OEMBED: Record<string, string> = {
  soundcloud: 'https://soundcloud.com/oembed?format=json&url=',
  youtube:    'https://www.youtube.com/oembed?format=json&url=',
  mixcloud:   'https://www.mixcloud.com/oembed/?format=json&url=',
};

function detectPlatform(url: string): 'soundcloud' | 'youtube' | 'mixcloud' | 'other' {
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('mixcloud.com')) return 'mixcloud';
  return 'other';
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostMixModal({ onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState<{ title: string; thumbnail: string | null } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'set' | 'track'>('set');
  const [genre, setGenre] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = detectPlatform(url.trim());

  // Auto-fetch when URL looks complete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = url.trim();
    const looksValid = Object.keys(OEMBED).some(p => trimmed.includes(p + '.com')) || trimmed.includes('youtu.be');
    if (!looksValid) { setFetched(null); setFetchError(null); return; }
    debounceRef.current = setTimeout(() => fetchMeta(trimmed), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url]);

  async function fetchMeta(trimmed: string) {
    setFetching(true);
    setFetchError(null);
    setFetched(null);
    try {
      const p = detectPlatform(trimmed);
      const oembedBase = OEMBED[p];
      if (oembedBase) {
        const res = await fetch(`${oembedBase}${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setFetched({ title: data.title ?? '', thumbnail: data.thumbnail_url ?? null });
          setTitle(data.title ?? '');
          // Auto-detect set vs track from URL
          if (p === 'soundcloud' && trimmed.includes('/sets/')) setType('set');
          else if (p === 'soundcloud') setType('track');
          return;
        }
      }
      setFetched({ title: '', thumbnail: null });
      setFetchError('Could not fetch details — fill in the title below.');
    } catch {
      setFetched({ title: '', thumbnail: null });
      setFetchError('Could not reach that URL — check the link.');
    } finally {
      setFetching(false);
    }
  }

  async function submit() {
    if (!url.trim()) { setError('Paste a link first.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const { error: dbErr } = await supabase.from('mixes').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      type,
      platform,
      external_url: url.trim().split('?')[0].replace(/\/$/, ''),
      thumbnail_url: fetched?.thumbnail ?? null,
      genre: genre || null,
    });
    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message.includes('duplicate') ? 'You\'ve already posted that link.' : 'Failed to post — try again.');
      return;
    }
    onSuccess();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.textSec} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Share a mix</Text>
            <TouchableOpacity
              style={[s.postBtn, (!fetched || submitting) && { opacity: 0.4 }]}
              onPress={submit}
              disabled={!fetched || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.postBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

            {/* URL input */}
            <Text style={s.label}>Link</Text>
            <View style={s.urlRow}>
              <TextInput
                style={[s.input, s.urlInput]}
                value={url}
                onChangeText={setUrl}
                placeholder="soundcloud.com/... mixcloud.com/... youtu.be/..."
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {fetching && (
                <View style={s.urlSpinner}>
                  <ActivityIndicator size="small" color={C.accent} />
                </View>
              )}
              {fetched && !fetching && (
                <View style={s.urlSpinner}>
                  <Ionicons name="checkmark-circle" size={20} color={C.success} />
                </View>
              )}
            </View>

            {/* Platform badge */}
            {url.trim().length > 0 && (
              <View style={s.platformRow}>
                <View style={[s.platformBadge, { backgroundColor: platform === 'soundcloud' ? '#FF550020' : platform === 'youtube' ? '#FF000020' : platform === 'mixcloud' ? '#52AAD820' : C.raised }]}>
                  <Text style={[s.platformText, { color: platform === 'soundcloud' ? '#FF5500' : platform === 'youtube' ? '#FF0000' : platform === 'mixcloud' ? '#52AAD8' : C.textMuted }]}>
                    {platform === 'other' ? 'External link' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {fetchError && <Text style={s.fetchError}>{fetchError}</Text>}

            {fetched && (
              <>
                {/* Title */}
                <Text style={s.label}>Title</Text>
                <TextInput
                  style={s.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Mix title"
                  placeholderTextColor={C.textMuted}
                />

                {/* Type */}
                <Text style={s.label}>Type</Text>
                <View style={s.typeRow}>
                  {(['set', 'track'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.typeBtn, type === t && s.typeBtnActive]}
                      onPress={() => setType(t)}
                    >
                      <Ionicons
                        name={t === 'set' ? 'disc-outline' : 'musical-note-outline'}
                        size={15}
                        color={type === t ? C.accent : C.textSec}
                      />
                      <Text style={[s.typeBtnText, type === t && { color: C.accent }]}>
                        {t === 'set' ? 'DJ Set' : 'Track'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Genre */}
                <Text style={s.label}>Genre</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.genreScroll}>
                  {GENRES.map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[s.genrePill, genre === g && s.genrePillActive]}
                      onPress={() => setGenre(genre === g ? '' : g)}
                    >
                      <Text style={[s.genrePillText, genre === g && { color: C.accent }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Description */}
                <Text style={s.label}>Description (optional)</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a tracklist, notes, anything…"
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </>
            )}

            {error && <Text style={s.error}>{error}</Text>}

            {!fetched && !fetching && (
              <View style={s.hint}>
                <Ionicons name="link-outline" size={32} color={C.textMuted} />
                <Text style={s.hintText}>Paste a link from SoundCloud, Mixcloud or YouTube, then tap Fetch to auto-fill the details.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  postBtn: { backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  body: { padding: 16, gap: 4, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  urlInput: { flex: 1 },
  urlSpinner: { width: 32, alignItems: 'center' },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  platformRow: { marginTop: 6 },
  platformBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  platformText: { fontSize: 12, fontWeight: '600' },
  fetchError: { fontSize: 12, color: C.textMuted, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  typeBtnActive: { borderColor: C.accent, backgroundColor: C.accentDim + '30' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: C.textSec },
  genreScroll: { gap: 6, paddingVertical: 2 },
  genrePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  genrePillActive: { borderColor: C.accent, backgroundColor: C.accentDim + '20' },
  genrePillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  error: { fontSize: 13, color: C.critical, marginTop: 12, textAlign: 'center' },
  hint: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 16 },
  hintText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
});
