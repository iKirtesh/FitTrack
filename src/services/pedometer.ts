import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

export type StepSupport = { supported: true } | { supported: false; reason: string };

/** Honest capability check: web never has a pedometer, and some devices lack the sensor. */
export async function stepSupport(): Promise<StepSupport> {
  if (Platform.OS === 'web') return { supported: false, reason: 'Automatic step counting is not available on web. Enter your steps manually.' };
  try {
    if (!(await Pedometer.isAvailableAsync())) return { supported: false, reason: 'This device has no step sensor. Enter your steps manually.' };
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return { supported: false, reason: 'Motion permission was not granted. Enter your steps manually.' };
    return { supported: true };
  } catch {
    return { supported: false, reason: 'Step sensor could not be read. Enter your steps manually.' };
  }
}

/**
 * Steps since local midnight. iOS can query history; Android only reports steps while subscribed,
 * so there `null` is returned and the caller must not pretend to know the day's total.
 */
export async function stepsToday(): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  try { return (await Pedometer.getStepCountAsync(start, new Date())).steps; } catch { return null; }
}

/**
 * Live step counting. Works on Android and iOS, but only while this subscription is alive
 * (i.e. while the app is open): `onSteps` receives steps counted since the subscription began.
 */
export function watchSteps(onSteps: (sinceStart: number) => void): () => void {
  const sub = Pedometer.watchStepCount((r) => onSteps(r.steps));
  return () => sub.remove();
}
