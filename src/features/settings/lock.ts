import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * PIN storage. Native: salted SHA-256 in the OS keystore/keychain (SecureStore).
 * Web: the same value in localStorage, which is NOT secure storage; the UI says so.
 * This is a convenience lock against casual access, not encryption of the database.
 */
const KEY = 'fittrack.lock';
const read = async () => (Platform.OS === 'web' ? (typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null) : SecureStore.getItemAsync(KEY));
const write = async (v: string) => (Platform.OS === 'web' ? void localStorage.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v));
const erase = async () => (Platform.OS === 'web' ? void localStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY));

const hash = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function isLockEnabled(): Promise<boolean> {
  try { return (await read()) != null; } catch { return false; }
}
export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4 to 8 digits');
  const salt = Crypto.randomUUID();
  await write(`${salt}:${await hash(salt, pin)}`);
}
export async function verifyPin(pin: string): Promise<boolean> {
  const v = await read();
  if (!v) return true;
  const [salt, h] = v.split(':');
  return !!salt && (await hash(salt, pin)) === h;
}
export async function disableLock(): Promise<void> { await erase(); }
export const lockIsSecureStorage = Platform.OS !== 'web';

/** Optional label shown on the lock screen. Stored only on this device and never verified or sent anywhere. */
const EMAIL_KEY = 'fittrack.lock.email';
export const isGmail = (s: string) => /^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/i.test(s.trim());
export async function getLockEmail(): Promise<string | null> {
  try { return Platform.OS === 'web' ? (typeof localStorage !== 'undefined' ? localStorage.getItem(EMAIL_KEY) : null) : await SecureStore.getItemAsync(EMAIL_KEY); } catch { return null; }
}
export async function setLockEmail(email: string | null): Promise<void> {
  if (email && !isGmail(email)) throw new Error('Enter a valid Gmail address');
  const v = email?.trim().toLowerCase() ?? null;
  if (Platform.OS === 'web') { if (v) localStorage.setItem(EMAIL_KEY, v); else localStorage.removeItem(EMAIL_KEY); return; }
  if (v) await SecureStore.setItemAsync(EMAIL_KEY, v); else await SecureStore.deleteItemAsync(EMAIL_KEY);
}
