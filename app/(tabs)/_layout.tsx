import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import AvatarButton from '../../src/components/AvatarButton';

const ACCENT = '#7C5CFC';
const MUTED = '#52516A';
const SURFACE = '#13131A';

export default function TabLayout() {
  const initialize = useAuthStore(s => s.initialize);
  useEffect(() => { initialize(); }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: SURFACE },
        headerTintColor: '#F0EFF8',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerLeft: () => <AvatarButton />,
        headerLeftContainerStyle: { paddingLeft: 16 },
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: '#2A2A38',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Hardware',
        tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="usb-check" options={{
        title: 'USB Check',
        tabBarIcon: ({ color, size }) => <Ionicons name="disc-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="mixes" options={{
        title: 'Mixes',
        tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="set-builder" options={{
        title: 'Set Builder',
        tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="directory" options={{
        title: 'Directory',
        tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="gigs" options={{
        title: 'Gigs',
        tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="festival-sets" options={{
        title: 'Sets',
        tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="gig-calc" options={{
        title: 'Gig Calc',
        tabBarIcon: ({ color, size }) => <Ionicons name="calculator-outline" color={color} size={size} />,
      }} />
    </Tabs>
  );
}
