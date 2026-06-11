import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Image, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as AuthSession from 'expo-auth-session';
import { supabase, SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_REDIRECT_URI } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  success: '#4DCC8F', successBg: '#071A0F',
  warning: '#F5A623',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
  soundcloud: '#FF5500', soundcloudBg: '#1A0E00',
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
          <Text style={s.title}>Profile</Text>
          <TouchableOpacity onPress={saveProfile} disabled={saving} style={s.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Text style={[s.saveBtnText, saved && { color: C.success }]}>
                  {saved ? 'Saved!' : 'Save'}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.avatarSection}>
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
});
