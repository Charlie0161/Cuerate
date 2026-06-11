import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Image, ActivityIndicator, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as AuthSession from 'expo-auth-session';
import { supabase, SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_REDIRECT_URI } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import PostBookingRequestModal from './PostBookingRequestModal';
import VenueProfileModal from './VenueProfileModal';
import { Venue } from './VenueDirectoryScreen';
import AdminScreen from './AdminScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  success: '#4DCC8F', successBg: '#071A0F',
  warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
  soundcloud: '#FF5500', soundcloudBg: '#1A0E00', gold: '#F0C040',
};

const GENRES = ['House', 'Techno', 'Drum & Bass', 'UK Garage', 'Jungle', 'Trance', 'Hip-Hop', 'Afrobeats', 'Disco', 'Ambient', 'Other'];

export default function ProfileScreen({ onClose }: { onClose: () => void }) {
  const { profile, user, updateProfile, signOut } = useAuthStore();
  const [djName, setDjName] = useState(profile?.dj_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scLoading, setScLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  // Fallback: manual SoundCloud URL input
  const [showScManual, setShowScManual] = useState(false);
  const [scManualUrl, setScManualUrl] = useState(profile?.soundcloud_url ?? '');
  const [genre, setGenre] = useState(profile?.genre ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [bookingEmail, setBookingEmail] = useState(profile?.booking_email ?? '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? false);
  const [activeTab, setActiveTab] = useState<'dj' | 'venue'>('dj');

  // Venue state
  const [gigSlots, setGigSlots] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [showPostGig, setShowPostGig] = useState(false);
  const [appsLoading, setAppsLoading] = useState(false);
  const [enablingVenue, setEnablingVenue] = useState(false);
  const [myVenue, setMyVenue] = useState<Venue | null>(null);
  const [showMyVenue, setShowMyVenue] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]).then(([followers, following]) => {
      setFollowerCount(followers.count ?? 0);
      setFollowingCount(following.count ?? 0);
    });
  }, [user]);

  useEffect(() => {
    if (profile?.is_venue && user) {
      fetchVenueData();
      supabase.from('venue_directory').select('*').eq('owner_id', user.id).maybeSingle()
        .then(({ data }) => setMyVenue(data as Venue | null));
    }
  }, [profile?.is_venue, user]);

  async function fetchVenueData() {
    if (!user) return;
    setAppsLoading(true);
    const { data: slots } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('venue_id', user.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setGigSlots(slots ?? []);
    if (slots && slots.length > 0) {
      const ids = slots.map((s: any) => s.id);
      const { data: apps } = await supabase
        .from('booking_applications')
        .select('*')
        .in('request_id', ids)
        .order('created_at', { ascending: false });

      if (apps && apps.length > 0) {
        const djIds = [...new Set(apps.map((a: any) => a.dj_id))];
        const { data: djProfiles } = await supabase
          .from('profiles')
          .select('id, dj_name, booking_email, avatar_url')
          .in('id', djIds);
        const profileMap = Object.fromEntries((djProfiles ?? []).map((p: any) => [p.id, p]));
        setApplications(apps.map((a: any) => ({ ...a, profiles: profileMap[a.dj_id] ?? null })));
      } else {
        setApplications(apps ?? []);
      }
    }
    setAppsLoading(false);
  }

  async function handleAccept(appId: string, djName: string, djEmail: string | null, djId: string, slot: any) {
    await supabase.from('booking_applications').update({ status: 'accepted' }).eq('id', appId);
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'accepted' } : a));
    // Auto-add to the DJ's gig calendar
    await supabase.from('dj_gigs').insert({
      dj_id: djId,
      venue_name: slot.venue_name,
      venue_id: user!.id,
      date: slot.date,
      fee: slot.fee_min ?? null,
      source: 'booking',
    });
    Alert.alert(
      `Accepted — ${djName}`,
      djEmail
        ? `Contact them at:\n${djEmail}`
        : 'This DJ has not set a booking email. Try reaching them through the DJ Directory.',
      [{ text: 'OK' }]
    );
  }

  async function handleDecline(appId: string) {
    await supabase.from('booking_applications').update({ status: 'declined' }).eq('id', appId);
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'declined' } : a));
  }

  function formatFee(min: number | null, max: number | null) {
    if (!min && !max) return 'Fee TBC';
    const fmt = (p: number) => `£${(p / 100).toFixed(0)}`;
    if (min && max) return `${fmt(min)}–${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
  }

  async function enableVenueAccount() {
    setEnablingVenue(true);
    await updateProfile({ is_venue: true });
    setEnablingVenue(false);
    fetchVenueData();
  }

  async function saveProfile() {
    setSaving(true);
    await updateProfile({ dj_name: djName.trim(), bio: bio.trim(), genre: genre || null, location: location.trim() || null, booking_email: bookingEmail.trim() || null, is_public: isPublic });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function connectSoundCloud() {
    setScLoading(true);
    try {
      // PKCE flow
      const codeVerifier = AuthSession.generateRandomString(64);
      const codeChallenge = AuthSession.generateRandomString(43);

      const authUrl =
        `https://secure.soundcloud.com/authorize` +
        `?client_id=${SOUNDCLOUD_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(SOUNDCLOUD_REDIRECT_URI)}` +
        `&response_type=code` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256` +
        `&state=boothbuddy`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, SOUNDCLOUD_REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          const tokenRes = await fetch('https://secure.soundcloud.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: SOUNDCLOUD_CLIENT_ID,
              client_secret: 'ZOSo39MuYXZ5jZXaCtXQECNVNuniDFGx',
              redirect_uri: SOUNDCLOUD_REDIRECT_URI,
              grant_type: 'authorization_code',
              code,
              code_verifier: codeVerifier,
            }).toString(),
          });
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            const profileRes = await fetch('https://api.soundcloud.com/me', {
              headers: { Authorization: `OAuth ${tokenData.access_token}` },
            });
            const scProfile = await profileRes.json();
            await updateProfile({
              soundcloud_url: scProfile.permalink_url,
              soundcloud_username: scProfile.username,
              soundcloud_avatar: scProfile.avatar_url?.replace('-large', '-t300x300'),
            });
            if (!profile?.avatar_url && scProfile.avatar_url) {
              await updateProfile({
                avatar_url: scProfile.avatar_url.replace('-large', '-t300x300'),
              });
            }
          } else {
            // Token exchange failed — fall back to manual
            setShowScManual(true);
          }
        }
      } else {
        // Auth session cancelled or blank — fall back to manual
        setShowScManual(true);
      }
    } catch (e) {
      // Any error — offer manual fallback
      setShowScManual(true);
    } finally {
      setScLoading(false);
    }
  }

  async function saveManualSoundCloud() {
    if (!scManualUrl.trim()) return;
    const raw = scManualUrl.trim();
    // Extract username from URL or use as-is
    const match = raw.match(/soundcloud\.com\/([^/?#]+)/);
    const username = match ? match[1] : raw.replace('@', '');
    await updateProfile({
      soundcloud_url: `https://soundcloud.com/${username}`,
      soundcloud_username: username,
    });
    setShowScManual(false);
  }

  async function disconnectSoundCloud() {
    Alert.alert('Disconnect SoundCloud', 'Remove your SoundCloud connection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: () => updateProfile({
          soundcloud_url: null,
          soundcloud_username: null,
          soundcloud_avatar: null,
        }),
      },
    ]);
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarLoading(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: fileName, type: `image/${ext}` } as any);
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await updateProfile({ avatar_url: urlData.publicUrl });
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Try again.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: () => { signOut(); onClose(); },
      },
    ]);
  }

  const avatarUri = profile?.avatar_url ?? profile?.soundcloud_avatar;
  const initials = (profile?.dj_name ?? profile?.email ?? 'DJ').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.title}>Profile</Text>
            {profile?.is_admin && (
              <View style={s.adminBadge}>
                <Text style={s.adminBadgeText}>👑 Admin</Text>
              </View>
            )}
            {profile?.account_type === 'fan' && (
              <View style={[s.adminBadge, { backgroundColor: C.accentDim + '30', borderColor: C.accent + '50' }]}>
                <Text style={[s.adminBadgeText, { color: C.accent }]}>🎵 Music Fan</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={saveProfile} disabled={saving} style={s.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Text style={[s.saveBtnText, saved && { color: C.success }]}>
                  {saved ? 'Saved!' : 'Save'}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* Follower stats */}
        <View style={s.followStatsRow}>
          <View style={s.followStat}>
            <Text style={s.followStatVal}>{followerCount}</Text>
            <Text style={s.followStatLabel}>Followers</Text>
          </View>
          <View style={s.followStatDivider} />
          <View style={s.followStat}>
            <Text style={s.followStatVal}>{followingCount}</Text>
            <Text style={s.followStatLabel}>Following</Text>
          </View>
        </View>

        {/* Role tab switcher — hidden for fans */}
        {profile?.account_type !== 'fan' && (
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, activeTab === 'dj' && s.tabActive]}
              onPress={() => setActiveTab('dj')}
            >
              <Ionicons name="musical-notes-outline" size={14} color={activeTab === 'dj' ? C.accent : C.textMuted} />
              <Text style={[s.tabText, activeTab === 'dj' && s.tabTextActive]}>DJ Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'venue' && s.tabActive]}
              onPress={() => setActiveTab('venue')}
            >
              <Ionicons name="business-outline" size={14} color={activeTab === 'venue' ? C.accent : C.textMuted} />
              <Text style={[s.tabText, activeTab === 'venue' && s.tabTextActive]}>Venue</Text>
              {profile?.is_venue && applications.filter(a => a.status === 'pending').length > 0 && (
                <View style={s.tabDot} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Avatar */}
        <View style={[s.avatarSection, activeTab === 'venue' && { display: 'none' }]}>
          <TouchableOpacity onPress={pickAvatar} style={s.avatarWrap}>
            {avatarLoading ? (
              <ActivityIndicator size="large" color={C.accent} />
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={s.avatarHint}>Tap to change photo</Text>
        </View>

        {/* ── DJ TAB ── */}
        {activeTab === 'dj' && <>

        {/* DJ Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>DJ Info</Text>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>DJ name</Text>
            <View style={s.fieldRow}>
              <Ionicons name="person-outline" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={s.field} value={djName} onChangeText={setDjName}
                placeholder="Your DJ name" placeholderTextColor={C.textMuted} />
            </View>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Email</Text>
            <View style={[s.fieldRow, { opacity: 0.5 }]}>
              <Ionicons name="mail-outline" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <Text style={[s.field, { color: C.textSec }]}>{user?.email}</Text>
            </View>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Bio</Text>
            <TextInput style={s.bioField} value={bio} onChangeText={setBio}
              placeholder="Tell other DJs about yourself..."
              placeholderTextColor={C.textMuted}
              multiline numberOfLines={3} />
          </View>
        </View>

        {/* Directory */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.cardTitle}>DJ Directory</Text>
            <TouchableOpacity
              style={[s.toggleSwitch, isPublic && s.toggleSwitchOn]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={[s.toggleThumb, isPublic && s.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 17 }}>
            {isPublic ? '✓ Your profile is visible in the DJ Directory' : 'Enable to appear in the public DJ Directory'}
          </Text>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Genre</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                {GENRES.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                      borderColor: genre === g ? C.accent : C.border,
                      backgroundColor: genre === g ? C.accentDim + '33' : 'transparent',
                    }}
                    onPress={() => setGenre(genre === g ? '' : g)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: genre === g ? C.accent : C.textMuted }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Location</Text>
            <View style={s.fieldRow}>
              <Ionicons name="location-outline" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={s.field} value={location} onChangeText={setLocation}
                placeholder="e.g. London, UK" placeholderTextColor={C.textMuted} />
            </View>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Booking email <Text style={{ color: C.textMuted, fontWeight: '400' }}>(optional)</Text></Text>
            <View style={s.fieldRow}>
              <Ionicons name="mail-outline" size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={s.field} value={bookingEmail} onChangeText={setBookingEmail}
                placeholder="bookings@youremail.com" placeholderTextColor={C.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
        </View>

        {/* SoundCloud */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Music</Text>

          {profile?.soundcloud_username ? (
            // Connected state
            <View style={s.connectedService}>
              <View style={[s.serviceIcon, { backgroundColor: C.soundcloudBg }]}>
                <Ionicons name="musical-note" size={20} color={C.soundcloud} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.serviceConnectedLabel}>SoundCloud connected</Text>
                <Text style={s.serviceUsername}>@{profile.soundcloud_username}</Text>
              </View>
              <TouchableOpacity onPress={disconnectSoundCloud} style={s.disconnectBtn}>
                <Text style={s.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : showScManual ? (
            // Manual URL fallback
            <View style={s.manualScBox}>
              <Text style={s.manualScTitle}>Enter your SoundCloud URL</Text>
              <Text style={s.manualScSub}>
                e.g. soundcloud.com/your-dj-name
              </Text>
              <View style={s.fieldRow}>
                <Ionicons name="musical-note" size={16} color={C.soundcloud} style={{ marginRight: 10 }} />
                <TextInput style={s.field} value={scManualUrl} onChangeText={setScManualUrl}
                  placeholder="soundcloud.com/your-name"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none" autoCorrect={false} />
              </View>
              <View style={s.manualScActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowScManual(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={saveManualSoundCloud}>
                  <Text style={s.confirmBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Connect buttons
            <>
              <TouchableOpacity
                style={[s.serviceBtn, { backgroundColor: C.soundcloudBg, borderColor: C.soundcloud + '50' }]}
                onPress={connectSoundCloud} disabled={scLoading}>
                {scLoading ? (
                  <ActivityIndicator size="small" color={C.soundcloud} />
                ) : (
                  <>
                    <Ionicons name="musical-note" size={20} color={C.soundcloud} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.serviceBtnText, { color: C.soundcloud }]}>
                        Connect SoundCloud
                      </Text>
                      <Text style={s.serviceBtnSub}>
                        Import your profile picture and DJ name
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.soundcloud} />
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.manualLinkBtn} onPress={() => setShowScManual(true)}>
                <Text style={s.manualLinkText}>Enter URL manually instead</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={s.moreServicesNote}>
            More services coming soon — Mixcloud, Beatport, Spotify
          </Text>
        </View>

        {/* End DJ tab */}
        </>}

        {/* ── VENUE TAB ── */}
        {activeTab === 'venue' && !profile?.is_venue && (
          <View style={s.card}>
            <View style={s.venueEnableBox}>
              <Ionicons name="business-outline" size={32} color={C.accent} />
              <Text style={s.venueEnableTitle}>Enable venue account</Text>
              <Text style={s.venueEnableDesc}>
                Post open gig slots and receive DJ applications — without losing your DJ profile.
              </Text>
              <TouchableOpacity
                style={[s.venueEnableBtn, enablingVenue && { opacity: 0.6 }]}
                onPress={enableVenueAccount}
                disabled={enablingVenue}
              >
                {enablingVenue
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.venueEnableBtnText}>Enable venue features</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'venue' && profile?.is_venue && (
          <View style={s.card}>
            <Text style={s.cardTitle}>My Venue Listing</Text>
            {myVenue ? (
              <TouchableOpacity style={s.myVenueCard} onPress={() => setShowMyVenue(true)} activeOpacity={0.8}>
                <View style={s.myVenueIcon}>
                  <Ionicons name="business" size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.myVenueName}>{myVenue.name}</Text>
                  <Text style={s.myVenueCity}>{myVenue.city}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 4 }}>
                No venue listing linked yet. Add your venue to the directory or claim an existing one.
              </Text>
            )}
          </View>
        )}

        {activeTab === 'venue' && profile?.is_venue && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.cardTitle}>Gig Slots</Text>
              <TouchableOpacity style={s.postGigBtn} onPress={() => setShowPostGig(true)}>
                <Ionicons name="add" size={14} color={C.accent} />
                <Text style={s.postGigBtnText}>Post slot</Text>
              </TouchableOpacity>
            </View>

            {appsLoading ? (
              <ActivityIndicator size="small" color={C.accent} />
            ) : gigSlots.length === 0 ? (
              <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 12 }}>
                No open gig slots. Post one to receive DJ applications.
              </Text>
            ) : gigSlots.map(slot => {
              const slotApps = applications.filter(a => a.request_id === slot.id);
              const pendingCount = slotApps.filter(a => a.status === 'pending').length;
              const isExpanded = expandedSlot === slot.id;
              return (
                <View key={slot.id} style={s.slotCard}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    onPress={() => setExpandedSlot(isExpanded ? null : slot.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotDate}>{slot.date}</Text>
                      <Text style={s.slotMeta}>
                        {slot.genre ?? 'Any genre'} · {formatFee(slot.fee_min, slot.fee_max)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {pendingCount > 0 && (
                        <View style={s.appBadge}>
                          <Text style={s.appBadgeText}>{pendingCount} new</Text>
                        </View>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14} color={C.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                      {slotApps.length === 0 ? (
                        <Text style={{ fontSize: 12, color: C.textMuted }}>No applications yet.</Text>
                      ) : slotApps.map(app => (
                        <View key={app.id} style={s.appCard}>
                          <Text style={s.appDjName}>{app.profiles?.dj_name ?? 'Unknown DJ'}</Text>
                          {app.message ? <Text style={s.appMessage}>{app.message}</Text> : null}
                          {app.status === 'pending' ? (
                            <View style={s.appActions}>
                              <TouchableOpacity
                                style={s.acceptBtn}
                                onPress={() => handleAccept(app.id, app.profiles?.dj_name ?? 'DJ', app.profiles?.booking_email, app.dj_id, slot)}
                              >
                                <Text style={s.acceptBtnText}>Accept</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={s.declineBtn}
                                onPress={() => handleDecline(app.id)}
                              >
                                <Text style={s.declineBtnText}>Decline</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={[s.appStatusPill, app.status === 'accepted' ? s.appStatusAccepted : s.appStatusDeclined]}>
                              <Text style={[s.appStatusText, { color: app.status === 'accepted' ? C.success : C.critical }]}>
                                {app.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Admin panel */}
        {profile?.is_admin && (
          <TouchableOpacity style={s.adminBtn} onPress={() => setShowAdmin(true)}>
            <Text style={s.adminBtnEmoji}>👑</Text>
            <Text style={s.adminBtnText}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={16} color="#F0C040" />
          </TouchableOpacity>
        )}

        {/* Account */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Account</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={16} color={C.critical} />
            <Text style={s.dangerBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {showPostGig && profile && (
        <PostBookingRequestModal
          venueName={profile.dj_name ?? 'Venue'}
          venueId={user!.id}
          onClose={() => setShowPostGig(false)}
          onSuccess={() => { setShowPostGig(false); fetchVenueData(); }}
        />
      )}
      {showAdmin && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <AdminScreen onClose={() => setShowAdmin(false)} />
        </Modal>
      )}

      {showMyVenue && myVenue && (
        <VenueProfileModal
          venue={myVenue}
          onClose={() => setShowMyVenue(false)}
          onReviewSubmitted={() => {
            supabase.from('venue_directory').select('*').eq('owner_id', user!.id).maybeSingle()
              .then(({ data }) => setMyVenue(data as Venue | null));
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  closeBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: C.accent },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: C.accent },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.accentDim + '50', borderWidth: 2, borderColor: C.accent + '60', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: C.accent },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  avatarHint: { fontSize: 12, color: C.textMuted, marginTop: 8 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46 },
  field: { flex: 1, fontSize: 15, color: C.text },
  bioField: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 80, textAlignVertical: 'top' },
  connectedService: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  serviceIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  serviceConnectedLabel: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  serviceUsername: { fontSize: 15, color: C.text, fontWeight: '600' },
  disconnectBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.critical + '50' },
  disconnectText: { fontSize: 12, color: C.critical, fontWeight: '600' },
  serviceBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  serviceBtnText: { fontSize: 15, fontWeight: '600' },
  serviceBtnSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  manualLinkBtn: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 4 },
  manualLinkText: { fontSize: 13, color: C.textMuted, textDecorationLine: 'underline' },
  manualScBox: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12, gap: 10 },
  manualScTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  manualScSub: { fontSize: 12, color: C.textMuted, marginTop: -6 },
  manualScActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent },
  confirmBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  moreServicesNote: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 4 },
  toggleSwitch: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#2A2A38', justifyContent: 'center', paddingHorizontal: 3 },
  toggleSwitchOn: { backgroundColor: '#3D2E8A' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#52516A' },
  toggleThumbOn: { backgroundColor: '#7C5CFC', alignSelf: 'flex-end' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: C.criticalBg, borderRadius: 10, borderWidth: 1, borderColor: C.critical + '40' },
  dangerBtnText: { fontSize: 15, color: C.critical, fontWeight: '600' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1400', borderWidth: 1, borderColor: '#F0C04040', borderRadius: 14, padding: 16, marginBottom: 12 },
  adminBtnEmoji: { fontSize: 20 },
  adminBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#F0C040' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A1F00', borderWidth: 1, borderColor: '#F0C04060', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: '#F0C040' },
  myVenueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 4 },
  myVenueIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.accentDim + '40', alignItems: 'center', justifyContent: 'center' },
  myVenueName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  myVenueCity: { fontSize: 12, color: C.textMuted },
  postGigBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim },
  postGigBtnText: { fontSize: 12, fontWeight: '600', color: C.accent },
  slotCard: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 },
  slotDate: { fontSize: 14, fontWeight: '700', color: C.text },
  slotMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  appBadge: { backgroundColor: C.accentDim + '40', borderWidth: 1, borderColor: C.accentDim, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  appBadgeText: { fontSize: 11, fontWeight: '600', color: C.accent },
  appCard: { backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, gap: 6 },
  appDjName: { fontSize: 14, fontWeight: '700', color: C.text },
  appMessage: { fontSize: 13, color: C.textSec, lineHeight: 18 },
  appActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  acceptBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: C.success + '20', borderWidth: 1, borderColor: C.success + '60' },
  acceptBtnText: { fontSize: 13, fontWeight: '600', color: C.success },
  declineBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: C.criticalBg, borderWidth: 1, borderColor: C.critical + '40' },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: C.critical },
  appStatusPill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginTop: 4 },
  appStatusAccepted: { backgroundColor: C.success + '15', borderColor: C.success + '50' },
  appStatusDeclined: { backgroundColor: C.criticalBg, borderColor: C.critical + '40' },
  appStatusText: { fontSize: 12, fontWeight: '600' },
  followStatsRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  followStat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  followStatVal: { fontSize: 20, fontWeight: '700', color: C.text },
  followStatLabel: { fontSize: 11, color: C.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  followStatDivider: { width: 1, backgroundColor: C.border },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 20, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  tabActive: { backgroundColor: C.accentDim + '50', borderWidth: 1, borderColor: C.accentDim },
  tabText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.accent },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  venueEnableBox: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  venueEnableTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  venueEnableDesc: { fontSize: 13, color: C.textSec, textAlign: 'center', lineHeight: 19 },
  venueEnableBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, marginTop: 4 },
  venueEnableBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
