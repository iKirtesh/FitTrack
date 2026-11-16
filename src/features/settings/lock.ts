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
