import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(userId: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
  } catch {}
}

export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientUserId)
      .single();

    const token = profile?.push_token;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
      }),
    });
  } catch {}
}
