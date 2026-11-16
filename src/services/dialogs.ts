import { Alert, Platform } from 'react-native';

/** Cross-platform confirm: Alert.alert does not render on web, so window.confirm is used there. */
export function confirm(title: string, message: string, confirmLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export const errorMessage = (e: unknown): string => {
  if (e && typeof e === 'object' && 'issues' in e && Array.isArray((e as { issues: { message: string }[] }).issues)) {
    return (e as { issues: { message: string }[] }).issues[0]?.message ?? 'Invalid input';
  }
  return e instanceof Error ? e.message : 'Something went wrong';
};
