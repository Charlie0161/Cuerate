import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/store/authStore';
import OnboardingScreen from '../src/screens/OnboardingScreen';
import { registerPushToken } from '../src/lib/notifications';
import ErrorBoundary from '../src/components/ErrorBoundary';

export default function RootLayout() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const initialize = useAuthStore(s => s.initialize);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    // Start auth and onboarding check in parallel — don't wait for one before the other
    initialize();
    AsyncStorage.getItem('onboarded').then(v => setOnboarded(v === '1'));
  }, []);

  useEffect(() => {
    if (user?.id) registerPushToken(user.id);
  }, [user?.id]);

  async function handleOnboardingDone() {
    setOnboarded(true);
  }

  // Dark background while AsyncStorage resolves — no white flash
  if (onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0C', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C5CFC" />
      </View>
    );
  }

  if (!onboarded) {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ErrorBoundary>
  );
}
