import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import AvatarButton from '../../src/components/AvatarButton';
import MessagesButton from '../../src/components/MessagesButton';
import NotificationsButton from '../../src/components/NotificationsButton';

const ACCENT = '#7C5CFC';
const MUTED = '#52516A';
const SURFACE = '#13131A';

export default function TabLayout() {
  const profile = useAuthStore(s => s.profile);

  const isFan = profile?.account_type === 'fan';

  // Fans only see Mixes, Directory, Sets
  const hide = (tab: string) => isFan && !['mixes', 'directory', 'festival-sets', 'whats-on'].includes(tab)
    ? { href: null as any }
    : {};

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: SURFACE },
        headerTintColor: '#F0EFF8',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerLeft: () => <AvatarButton />,
        headerLeftContainerStyle: { paddingLeft: 16 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <NotificationsButton />
            <MessagesButton />
          </View>
        ),
        headerRightContainerStyle: { paddingRight: 16 },
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
        ...hide('index'),
      }} />
      <Tabs.Screen name="mixes" options={{
        title: 'Mixes',
        tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="prepare" options={{
        title: 'Prepare',
        tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes-outline" color={color} size={size} />,
        ...hide('prepare'),
      }} />
      <Tabs.Screen name="directory" options={{
        title: 'Directory',
        tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="gigs" options={{
        title: 'Gigs',
        tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" color={color} size={size} />,
        ...hide('gigs'),
      }} />
      <Tabs.Screen name="festival-sets" options={{
        title: 'Sets',
        tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="whats-on" options={{
        title: "What's On",
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
      }} />

      {/* Hidden legacy screens */}
      <Tabs.Screen name="usb-check" options={{ href: null }} />
      <Tabs.Screen name="set-builder" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="gig-calc" options={{ href: null }} />
    </Tabs>
  );
}
