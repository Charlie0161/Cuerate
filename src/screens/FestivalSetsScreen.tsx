import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import SubmitSetModal from './SubmitSetModal';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface FestivalSet {
  id: string;
  dj_name: string;
  dj_profile_id: string | null;
  event_name: string;
  event_date: string | null;
  stage: string | null;
  genre: string | null;
  mix_url: string | null;
  tracklist_url: string | null;
  created_at: string;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FestivalSetsScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FestivalSet[]>([]);
  const [recent, setRecent] = useState<FestivalSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecent = useCallback(async () => {
    const { data } = await supabase
      .from('festival_sets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setRecent((data as FestivalSet[]) ?? []);
  }, []);

  useEffect(() => {
    loadRecent().finally(() => setLoading(false));
  }, [loadRecent]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('festival_sets')
        .select('*')
        .ilike('dj_name', `%${query.trim()}%`)
        .order('event_date', { ascending: false })
        .limit(100);
      setResults((data as FestivalSet[]) ?? []);
      setSearching(false);
    }, 350);
  }, [query]);

  async function onRefresh() {
    setRefreshing(true);
    await loadRecent();
    setRefreshing(false);
  }

  // Group sets by DJ name when showing search results
  function groupByDJ(sets: FestivalSet[]) {
    const map = new Map<string, FestivalSet[]>();
    sets.forEach(s => {
      const key = s.dj_name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).map(([, sets]) => ({ dj: sets[0].dj_name, sets }));
  }

  function renderSet(set: FestivalSet) {
    const isExpanded = expanded === set.id;
    return (
      <TouchableOpacity
        key={set.id}
        style={s.setCard}
        onPress={() => setExpanded(isExpanded ? null : set.id)}
        activeOpacity={0.75}
      >
        <View style={s.setTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.eventName}>{set.event_name}</Text>
            <View style={s.metaRow}>
              {set.event_date && (
                <>
                  <Ionicons name="calendar-outline" size={11} color={C.textMuted} />
                  <Text style={s.metaText}>{formatDate(set.event_date)}</Text>
                  <Text style={s.metaDot}>·</Text>
                </>
              )}
              {set.stage && <Text style={s.metaText}>{set.stage}</Text>}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {set.genre && (
              <View style={s.genrePill}>
                <Text style={s.genrePillText}>{set.genre}</Text>
              </View>
            )}
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
          </View>
        </View>

        {isExpanded && (
          <View style={s.setDetail}>
            {set.tracklist_url && (
              <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(set.tracklist_url!)}>
                <Ionicons name="list-outline" size={14} color={C.accent} />
                <Text style={s.linkBtnText}>View tracklist on 1001Tracklists</Text>
                <Ionicons name="open-outline" size={12} color={C.textMuted} />
              </TouchableOpacity>
            )}
            {set.mix_url && (
              <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(set.mix_url!)}>
                <Ionicons name="play-circle-outline" size={14} color={C.success} />
                <Text style={[s.linkBtnText, { color: C.success }]}>Listen to recording</Text>
                <Ionicons name="open-outline" size={12} color={C.textMuted} />
              </TouchableOpacity>
            )}
            {!set.tracklist_url && !set.mix_url && (
              <Text style={{ fontSize: 12, color: C.textMuted }}>No recording or tracklist linked.</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function renderDJGroup({ item }: { item: { dj: string; sets: FestivalSet[] } }) {
    return (
      <View style={s.djGroup}>
        <View style={s.djHeader}>
          <View style={s.djAvatar}>
            <Text style={s.djAvatarText}>{item.dj.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.djName}>{item.dj}</Text>
            <Text style={s.djSetCount}>{item.sets.length} set{item.sets.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        {item.sets.map(renderSet)}
      </View>
    );
  }

  function renderRecentSet({ item }: { item: FestivalSet }) {
    const isExpanded = expanded === item.id;
    return (
      <TouchableOpacity
        style={s.recentCard}
        onPress={() => setExpanded(isExpanded ? null : item.id)}
        activeOpacity={0.75}
      >
        <View style={s.recentTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.recentDJ}>{item.dj_name}</Text>
            <Text style={s.recentEvent}>{item.event_name}{item.stage ? ` · ${item.stage}` : ''}</Text>
            {item.event_date && (
              <Text style={s.recentDate}>{formatDate(item.event_date)}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {item.genre && (
              <View style={s.genrePill}>
                <Text style={s.genrePillText}>{item.genre}</Text>
              </View>
            )}
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
          </View>
        </View>

        {isExpanded && (
          <View style={s.setDetail}>
            {item.tracklist_url && (
              <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(item.tracklist_url!)}>
                <Ionicons name="list-outline" size={14} color={C.accent} />
                <Text style={s.linkBtnText}>View tracklist on 1001Tracklists</Text>
                <Ionicons name="open-outline" size={12} color={C.textMuted} />
              </TouchableOpacity>
            )}
            {item.mix_url && (
              <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(item.mix_url!)}>
                <Ionicons name="play-circle-outline" size={14} color={C.success} />
                <Text style={[s.linkBtnText, { color: C.success }]}>Listen to recording</Text>
                <Ionicons name="open-outline" size={12} color={C.textMuted} />
              </TouchableOpacity>
            )}
            {!item.tracklist_url && !item.mix_url && (
              <Text style={{ fontSize: 12, color: C.textMuted }}>No recording or tracklist linked.</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const grouped = groupByDJ(results);
  const isSearching = query.trim().length > 0;

  return (
    <View style={s.container}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search DJ name…"
            placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.submitBtn} onPress={() => setShowSubmit(true)}>
          <Ionicons name="add" size={18} color={C.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : isSearching ? (
        searching ? (
          <View style={s.center}><ActivityIndicator size="small" color={C.accent} /></View>
        ) : grouped.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={36} color={C.textMuted} />
            <Text style={s.emptyTitle}>No sets found for "{query}"</Text>
            <Text style={s.emptySub}>Be the first to submit one.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowSubmit(true)}>
              <Text style={s.emptyBtnText}>Submit a set</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={i => i.dj}
            renderItem={renderDJGroup}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          />
        )
      ) : (
        <FlatList
          data={recent}
          keyExtractor={i => i.id}
          renderItem={renderRecentSet}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListHeaderComponent={
            <Text style={s.sectionLabel}>Recently added</Text>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="musical-notes-outline" size={40} color={C.textMuted} />
              <Text style={s.emptyTitle}>No sets yet</Text>
              <Text style={s.emptySub}>Submit the first festival set to get the archive started.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowSubmit(true)}>
                <Text style={s.emptyBtnText}>Submit a set</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {showSubmit && (
        <SubmitSetModal
          onClose={() => setShowSubmit(false)}
          onSuccess={() => { setShowSubmit(false); loadRecent(); }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  submitBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  djGroup: { marginBottom: 20 },
  djHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  djAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentDim + '50', borderWidth: 1.5, borderColor: C.accent + '60', alignItems: 'center', justifyContent: 'center' },
  djAvatarText: { fontSize: 13, fontWeight: '700', color: C.accent },
  djName: { fontSize: 17, fontWeight: '700', color: C.text },
  djSetCount: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  setCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  setTop: { flexDirection: 'row', alignItems: 'flex-start' },
  eventName: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: C.textMuted },
  metaDot: { fontSize: 12, color: C.textMuted },
  recentCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  recentTop: { flexDirection: 'row', alignItems: 'flex-start' },
  recentDJ: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  recentEvent: { fontSize: 13, color: C.textSec },
  recentDate: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  genrePill: { backgroundColor: C.accentDim + '30', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  genrePillText: { fontSize: 10, fontWeight: '600', color: C.accent },
  setDetail: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, gap: 8 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10 },
  linkBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.accent },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { marginTop: 8, backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: C.accent },
});
