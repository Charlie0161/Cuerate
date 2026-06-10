import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CamelotKey =
  | '1A' | '2A' | '3A' | '4A' | '5A' | '6A'
  | '7A' | '8A' | '9A' | '10A' | '11A' | '12A'
  | '1B' | '2B' | '3B' | '4B' | '5B' | '6B'
  | '7B' | '8B' | '9B' | '10B' | '11B' | '12B';

export type TrackSource = 'manual' | 'shazam' | 'analyser';

export interface CrateTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  camelotKey: CamelotKey;
  energy: number; // 1–10
  durationSecs?: number;
  source: TrackSource;
  createdAt: number;
}

export interface GeneratedSet {
  id: string;
  name: string;
  targetMins: number;
  tracks: CrateTrack[];
  harmonicScore: number; // 0–100
  createdAt: number;
  savedToSupabase: boolean;
}

export type SetLength = 30 | 60 | 180 | 0; // 0 = custom (use all tracks)

// ─── Harmonic helpers (pure — exported so Shazam/Analyser can reuse) ─────────

export function keyCompat(a: CamelotKey | '', b: CamelotKey | ''): 0 | 1 | 2 | 3 {
  if (!a || !b || a === b) return a === b ? 3 : 0;
  const an = parseInt(a), bn = parseInt(b);
  const al = a.slice(-1), bl = b.slice(-1);
  // Relative major/minor (same number, opposite letter)
  if (an === bn && al !== bl) return 3;
  if (al === bl) {
    const diff = Math.min(Math.abs(an - bn), 12 - Math.abs(an - bn));
    if (diff === 1) return 3; // adjacent — very smooth
    if (diff === 2) return 2; // one step away — works
  }
  return 1; // clash
}

export function bpmCompat(a: number, b: number): 1 | 2 | 3 {
  const diff = Math.abs(a - b);
  if (diff <= 3) return 3;
  if (diff <= 8) return 2;
  return 1;
}

export function overallScore(a: CrateTrack, b: CrateTrack): number {
  return keyCompat(a.camelotKey, b.camelotKey) * 2 + bpmCompat(a.bpm, b.bpm);
}

/** Returns 0–100 harmonic flow score for an ordered set */
export function calcHarmonicScore(tracks: CrateTrack[]): number {
  if (tracks.length < 2) return 100;
  let total = 0;
  for (let i = 1; i < tracks.length; i++) {
    total += keyCompat(tracks[i - 1].camelotKey, tracks[i].camelotKey);
  }
  return Math.round((total / ((tracks.length - 1) * 3)) * 100);
}

/** Greedy nearest-neighbour set generation */
export function buildOptimalSet(
  pool: CrateTrack[],
  targetMins: SetLength,
): CrateTrack[] {
  if (pool.length === 0) return [];
  const TRACK_MINS = 6; // avg track duration estimate
  const maxTracks = targetMins === 0 ? pool.length : Math.ceil(targetMins / TRACK_MINS);

  const remaining = [...pool].sort((a, b) => a.bpm - b.bpm);
  const result: CrateTrack[] = [];

  // Start with lowest-energy track to open the set
  const startIdx = remaining.reduce((best, t, i) =>
    t.energy < remaining[best].energy ? i : best, 0);
  result.push(remaining.splice(startIdx, 1)[0]);

  while (remaining.length > 0 && result.length < maxTracks) {
    const current = result[result.length - 1];
    let bestIdx = 0;
    let bestScore = -1;
    remaining.forEach((t, i) => {
      const score = overallScore(current, t);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SetBuilderState {
  // Crate
  crate: CrateTrack[];
  addTrack: (track: Omit<CrateTrack, 'id' | 'createdAt'>) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<CrateTrack>) => void;
  clearCrate: () => void;

  // Set generation
  targetLength: SetLength;
  setTargetLength: (len: SetLength) => void;
  generatedSet: GeneratedSet | null;
  generateSet: () => void;
  clearSet: () => void;

  // Saved sets (local history)
  savedSets: GeneratedSet[];
  saveCurrentSet: (name: string) => void;
  deleteSavedSet: (id: string) => void;

  // Supabase sync
  syncing: boolean;
  syncError: string | null;
  syncCrateToSupabase: (userId: string) => Promise<void>;
  loadCrateFromSupabase: (userId: string) => Promise<void>;
  saveSetToSupabase: (set: GeneratedSet, userId: string) => Promise<void>;
}

export const useSetBuilderStore = create<SetBuilderState>()(
  persist(
    (set, get) => ({
      // ── Crate ───────────────────────────────────────────────────────────────
      crate: [],

      addTrack: (track) => {
        const newTrack: CrateTrack = {
          ...track,
          id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
        };
        set(state => ({ crate: [...state.crate, newTrack] }));
      },

      removeTrack: (id) =>
        set(state => ({ crate: state.crate.filter(t => t.id !== id) })),

      updateTrack: (id, updates) =>
        set(state => ({
          crate: state.crate.map(t => t.id === id ? { ...t, ...updates } : t),
        })),

      clearCrate: () => set({ crate: [] }),

      // ── Set generation ──────────────────────────────────────────────────────
      targetLength: 60,

      setTargetLength: (len) => set({ targetLength: len }),

      generatedSet: null,

      generateSet: () => {
        const { crate, targetLength } = get();
        if (crate.length < 2) return;
        const tracks = buildOptimalSet(crate, targetLength);
        const generated: GeneratedSet = {
          id: `set-${Date.now()}`,
          name: 'Untitled Set',
          targetMins: targetLength,
          tracks,
          harmonicScore: calcHarmonicScore(tracks),
          createdAt: Date.now(),
          savedToSupabase: false,
        };
        set({ generatedSet: generated });
      },

      clearSet: () => set({ generatedSet: null }),

      // ── Saved sets ──────────────────────────────────────────────────────────
      savedSets: [],

      saveCurrentSet: (name) => {
        const { generatedSet } = get();
        if (!generatedSet) return;
        const toSave = { ...generatedSet, name, id: `saved-${Date.now()}` };
        set(state => ({
          savedSets: [toSave, ...state.savedSets].slice(0, 20), // keep last 20
          generatedSet: toSave,
        }));
      },

      deleteSavedSet: (id) =>
        set(state => ({ savedSets: state.savedSets.filter(s => s.id !== id) })),

      // ── Supabase sync ───────────────────────────────────────────────────────
      syncing: false,
      syncError: null,

      syncCrateToSupabase: async (userId) => {
        const { crate } = get();
        set({ syncing: true, syncError: null });
        try {
          const rows = crate.map(t => ({
            user_id: userId,
            title: t.title,
            artist: t.artist || null,
            bpm: t.bpm,
            camelot_key: t.camelotKey,
            energy: t.energy,
            duration_secs: t.durationSecs ?? null,
            source: t.source,
          }));
          const { error } = await supabase
            .from('crate_tracks')
            .upsert(rows, { onConflict: 'user_id,title,artist' });
          if (error) throw error;
        } catch (e: any) {
          set({ syncError: e.message ?? 'Sync failed' });
        } finally {
          set({ syncing: false });
        }
      },

      loadCrateFromSupabase: async (userId) => {
        set({ syncing: true, syncError: null });
        try {
          const { data, error } = await supabase
            .from('crate_tracks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          if (data) {
            const tracks: CrateTrack[] = data.map((r: any) => ({
              id: r.id,
              title: r.title,
              artist: r.artist ?? '',
              bpm: r.bpm,
              camelotKey: r.camelot_key as CamelotKey,
              energy: r.energy ?? 5,
              durationSecs: r.duration_secs ?? undefined,
              source: r.source as TrackSource,
              createdAt: new Date(r.created_at).getTime(),
            }));
            set({ crate: tracks });
          }
        } catch (e: any) {
          set({ syncError: e.message ?? 'Load failed' });
        } finally {
          set({ syncing: false });
        }
      },

      saveSetToSupabase: async (savedSet, userId) => {
        set({ syncing: true, syncError: null });
        try {
          // 1. Insert the set record
          const { data: setData, error: setError } = await supabase
            .from('sets')
            .insert({
              user_id: userId,
              name: savedSet.name,
              target_mins: savedSet.targetMins,
              harmonic_score: savedSet.harmonicScore,
            })
            .select()
            .single();
          if (setError) throw setError;

          // 2. Ensure all tracks exist in crate_tracks, collect their DB ids
          const trackInserts = savedSet.tracks.map(t => ({
            user_id: userId,
            title: t.title,
            artist: t.artist || null,
            bpm: t.bpm,
            camelot_key: t.camelotKey,
            energy: t.energy,
            source: t.source,
          }));
          const { data: trackData, error: trackError } = await supabase
            .from('crate_tracks')
            .upsert(trackInserts, { onConflict: 'user_id,title,artist' })
            .select('id, title, artist');
          if (trackError) throw trackError;

          // 3. Link tracks to set with positions
          const setTracks = savedSet.tracks.map((t, i) => {
            const match = trackData?.find(
              (r: any) => r.title === t.title && (r.artist ?? '') === (t.artist ?? ''),
            );
            return { set_id: setData.id, track_id: match?.id, position: i + 1 };
          }).filter(r => r.track_id);

          const { error: linkError } = await supabase.from('set_tracks').insert(setTracks);
          if (linkError) throw linkError;

          // Mark as saved locally
          set(state => ({
            savedSets: state.savedSets.map(s =>
              s.id === savedSet.id ? { ...s, savedToSupabase: true } : s,
            ),
            generatedSet: state.generatedSet?.id === savedSet.id
              ? { ...state.generatedSet, savedToSupabase: true }
              : state.generatedSet,
          }));
        } catch (e: any) {
          set({ syncError: e.message ?? 'Save failed' });
        } finally {
          set({ syncing: false });
        }
      },
    }),
    {
      name: 'cuerate-set-builder-v1',
      storage: createJSONStorage(() => {
        try { return localStorage; } catch { return sessionStorage; }
      }),
      // Don't persist transient state
      partialize: (state) => ({
        crate: state.crate,
        savedSets: state.savedSets,
        targetLength: state.targetLength,
        generatedSet: state.generatedSet,
      }),
    },
  ),
);
