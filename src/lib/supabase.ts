import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://iaqprkjgphbzmgttpohy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcXBya2pncGhiem1ndHRwb2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODMyMzcsImV4cCI6MjA5NjY1OTIzN30.LRmtJ6KVKtZruYlDn0Psn9XzKZE7w5Gcmn1IMxOKeLU';

export const GOOGLE_CLIENT_ID = '535231617763-87c5epeo4nkv2iufka2g20qbhpet0jmk.apps.googleusercontent.com';
export const SOUNDCLOUD_CLIENT_ID = 'W6Nns4HSaBBNCc9t0l8GGVFhbu96vC6M';
export const SOUNDCLOUD_REDIRECT_URI = 'cuerate://soundcloud-callback';

// Secure storage adapter for Supabase sessions
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  dj_name: string | null;
  email: string | null;
  avatar_url: string | null;
  soundcloud_url: string | null;
  soundcloud_username: string | null;
  soundcloud_avatar: string | null;
  bio: string | null;
  genre: string | null;
  location: string | null;
  booking_email: string | null;
  preview_track_url: string | null;
  is_public: boolean | null;
  is_pro: boolean | null;
  is_venue: boolean | null;
  account_type: 'dj' | 'venue' | 'fan' | null;
  is_admin: boolean | null;
  created_at: string;
  updated_at: string;
};

export type CommunityCost = {
  id: string;
  name: string;
  typical_amount: number;
  description: string | null;
  submitted_by: string | null;
  submitted_by_user_id: string | null;
  approved: boolean;
  use_count: number;
  created_at: string;
};
