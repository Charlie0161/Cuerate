import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/store/authStore';
import OnboardingScreen from '../src/screens/OnboardingScreen';

export default function RootLayout() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarded').then(v => setOnboarded(v === '1'));
  }, []);

  async function handleOnboardingDone(role: string) {
    // Role will be applied to the profile in authStore.initialize after sign-in
    setOnboarded(true);
  }

  if (onboarded === null) return null; // splash while checking storage

  if (!onboarded) {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
