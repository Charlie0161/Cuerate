import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, Profile } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
    if (session?.user) get().fetchProfile();
    else set({ profile: null });
  },

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;
    set({ loading: true });
    try {
      // Select first — avoids a write on every app open
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        set({ profile: data });
        return;
      }

      // Row missing (new user) — create it
      if (error?.code === 'PGRST116') {
        const { data: created } = await supabase
          .from('profiles')
          .upsert(
            { id: user.id, email: user.email ?? null, updated_at: new Date().toISOString() },
            { onConflict: 'id', ignoreDuplicates: true }
          )
          .select()
          .single();
        if (created) set({ profile: created });
      }
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (!error && data) set({ profile: data });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null, initialized: true });
      if (session?.user) get().fetchProfile();
    });
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().fetchProfile();
        // Apply role chosen during onboarding on first sign-in
        const role = await AsyncStorage.getItem('onboard_role');
        if (role) {
          const { profile } = get();
          const updates: Record<string, any> = {};
          if (role === 'venue') { updates.account_type = 'venue'; updates.is_venue = true; }
          else if (role === 'both') { updates.is_venue = true; }
          else if (role === 'fan') { updates.account_type = 'fan'; }
          // 'dj' is the default — no changes needed
          if (Object.keys(updates).length > 0 && profile && !profile.is_venue) {
            await get().updateProfile(updates);
          }
          await AsyncStorage.removeItem('onboard_role');
        }
      } else {
        set({ profile: null });
      }
    });
  },
}));
