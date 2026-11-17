import { Platform } from 'react-native';
import { disableLock } from '@/features/settings/lock';
import { notificationsSupported } from '@/services/notifications';
import * as Notifications from 'expo-notifications';

/** Non-database state that "delete all data" must also clear: PIN, scheduled notifications. */
export async function clearAllAppState(): Promise<void> {
  await disableLock();
  if (notificationsSupported) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.clear();
}
