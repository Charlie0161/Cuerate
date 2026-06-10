import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!error && data) set({ profile: data });
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    const { user, profile } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
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
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) get().fetchProfile();
      else set({ profile: null });
    });
  },
}));
