import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  success: '#4DCC8F',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
  google: '#4285F4', googleBg: '#0D1A2E',
};

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthScreen({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [djName, setDjName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'boothbuddy' });

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: djName.trim() || email.split('@')[0] },
          },
        });
        if (error) throw error;
        setSuccess('Check your email to confirm your account, then log in.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onClose?.();
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'boothbuddy://reset-password',
      });
      if (error) throw error;
      setSuccess('Password reset link sent. Check your email.');
      setMode('login');
    } catch (e: any) {
      setError(e.message ?? 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success') onClose?.();
      }
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Close button if opened as modal */}
          {onClose && (
            <TouchableOpacity onPress={onClose} style={s.modalClose}>
              <Ionicons name="close" size={22} color={C.textSec} />
            </TouchableOpacity>
          )}

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoIcon}>
              <Ionicons name="musical-notes" size={32} color={C.accent} />
            </View>
            <Text style={s.logoText}>BoothBuddy</Text>
            <Text style={s.logoSub}>The all-in-one DJ companion</Text>
          </View>

          {/* Tab switcher */}
          {mode !== 'forgot' && (
            <View style={s.modeTabs}>
              <TouchableOpacity
                style={[s.modeTab, mode === 'login' && s.modeTabActive]}
                onPress={() => { setMode('login'); setError(''); setSuccess(''); }}>
                <Text style={[s.modeTabText, mode === 'login' && { color: C.accent }]}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeTab, mode === 'signup' && s.modeTabActive]}
                onPress={() => { setMode('signup'); setError(''); setSuccess(''); }}>
                <Text style={[s.modeTabText, mode === 'signup' && { color: C.accent }]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'forgot' && (
            <View style={s.forgotHeader}>
              <TouchableOpacity onPress={() => { setMode('login'); setError(''); }} style={s.backBtn}>
                <Ionicons name="arrow-back" size={18} color={C.textSec} />
                <Text style={s.backText}>Back to login</Text>
              </TouchableOpacity>
              <Text style={s.forgotTitle}>Reset password</Text>
              <Text style={s.forgotSub}>We'll send a reset link to your email.</Text>
            </View>
          )}

          {/* Form */}
          <View style={s.form}>
            {mode === 'signup' && (
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>DJ name</Text>
                <View style={s.fieldRow}>
                  <Ionicons name="person-outline" size={16} color={C.textMuted} style={s.fieldIcon} />
                  <TextInput style={s.field} placeholder="Your DJ name"
                    placeholderTextColor={C.textMuted} value={djName}
                    onChangeText={setDjName} autoCapitalize="words" />
                </View>
              </View>
            )}

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Email</Text>
              <View style={s.fieldRow}>
                <Ionicons name="mail-outline" size={16} color={C.textMuted} style={s.fieldIcon} />
                <TextInput style={s.field} placeholder="your@email.com"
                  placeholderTextColor={C.textMuted} value={email}
                  onChangeText={setEmail} keyboardType="email-address"
                  autoCapitalize="none" autoCorrect={false} />
              </View>
            </View>

            {mode !== 'forgot' && (
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Password</Text>
                <View style={s.fieldRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={C.textMuted} style={s.fieldIcon} />
                  <TextInput style={[s.field, { flex: 1 }]}
                    placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                    placeholderTextColor={C.textMuted} value={password}
                    onChangeText={setPassword} secureTextEntry={!showPassword}
                    autoCapitalize="none" />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
                {mode === 'login' && (
                  <TouchableOpacity onPress={() => { setMode('forgot'); setError(''); }} style={s.forgotLink}>
                    <Text style={s.forgotLinkText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {error !== '' && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color={C.critical} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}
            {success !== '' && (
              <View style={s.successBox}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} />
                <Text style={s.successText}>{success}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={mode === 'forgot' ? handleForgotPassword : handleEmailAuth}
              disabled={loading}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.primaryBtnText}>
                    {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                  </Text>}
            </TouchableOpacity>

            {mode !== 'forgot' && (
              <>
                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or</Text>
                  <View style={s.dividerLine} />
                </View>
                <TouchableOpacity
                  style={[s.socialBtn, { backgroundColor: C.googleBg, borderColor: C.google + '50' }]}
                  onPress={handleGoogleSignIn} disabled={loading}>
                  <Ionicons name="logo-google" size={18} color={C.google} />
                  <Text style={[s.socialBtnText, { color: C.google }]}>
                    {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={s.legalText}>
            By continuing you agree to BoothBuddy's Terms of Service and Privacy Policy.
            Your data is stored securely and never sold.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  modalClose: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.accentDim + '50', borderWidth: 1, borderColor: C.accent + '60', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  logoSub: { fontSize: 14, color: C.textMuted, marginTop: 4 },
  modeTabs: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 24 },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  modeTabActive: { backgroundColor: C.raised },
  modeTabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  forgotHeader: { marginBottom: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: C.textSec },
  forgotTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6 },
  forgotSub: { fontSize: 14, color: C.textMuted },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.textSec },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 48 },
  fieldIcon: { marginRight: 10 },
  field: { flex: 1, fontSize: 15, color: C.text },
  eyeBtn: { padding: 4 },
  forgotLink: { alignSelf: 'flex-end', marginTop: 6 },
  forgotLinkText: { fontSize: 13, color: C.accent },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.criticalBg, borderRadius: 8, borderWidth: 1, borderColor: C.critical, padding: 12 },
  errorText: { fontSize: 13, color: C.critical, flex: 1, lineHeight: 18 },
  successBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#071A0F', borderRadius: 8, borderWidth: 1, borderColor: C.success, padding: 12 },
  successText: { fontSize: 13, color: C.success, flex: 1, lineHeight: 18 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.textMuted },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, height: 52, borderWidth: 1 },
  socialBtnText: { fontSize: 15, fontWeight: '600' },
  legalText: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16, marginTop: 24 },
});
