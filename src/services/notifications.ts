import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Reminder } from '@/database/repositories/reminders';

export const notificationsSupported = Platform.OS !== 'web';

export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Android needs a channel before any notification can show. */
export async function setupChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

export async function cancelIds(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

/** Schedules one weekly repeating local notification per selected weekday. Returns their ids. Weekday is 1=Sunday..7=Saturday in expo-notifications. */
export async function scheduleReminder(r: Pick<Reminder, 'title' | 'body' | 'hour' | 'minute' | 'daysOfWeek'>): Promise<string[]> {
  if (!notificationsSupported) return [];
  await setupChannel();
  const ids: string[] = [];
  for (const d of r.daysOfWeek) {
    ids.push(await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body ?? undefined },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour: r.hour, minute: r.minute, channelId: 'reminders' },
    }));
  }
  return ids;
}
