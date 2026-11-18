import { exportAll, importBackup, type BackupFile } from '@/features/backup/backup';
import * as s from '@/database/schema';
import type { AppDb } from '@/types/db';

/** Stored under `security.` so they are never written into a backup file. */
export const SYNC_URL_KEY = 'security.syncUrl';
export const SYNC_CODE_KEY = 'security.syncCode';
export const SYNC_LAST_KEY = 'sync.last';

export const normalizeServerUrl = (raw: string): string => {
  let u = raw.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u;
};
export type SyncResult = { added: number };

/**
 * Two-way merge through the LAN server: upload everything, receive the union, add what is missing locally.
 * Nothing is ever deleted, and a row that exists on both sides keeps this device's version.
 */
export async function syncWithServer(db: AppDb, serverUrl: string, code: string): Promise<SyncResult> {
  const base = normalizeServerUrl(serverUrl);
  if (!base) throw new Error('Enter the server address first.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`${base}/api/sync`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code.trim()}` }, body: JSON.stringify(exportAll(db)) });
  } catch (e) {
    throw new Error(`Could not reach ${base}. Is the sync server running and are both devices on the same Wi-Fi? (${e instanceof Error ? e.message : String(e)})`);
  } finally { clearTimeout(timer); }
  if (res.status === 401) throw new Error('Wrong pairing code.');
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  const merged = (await res.json()) as BackupFile;
  // This device keeps its own profile; a brand-new device adopts the server's.
  if (db.select().from(s.userProfiles).get()) merged.tables.userProfiles = [];
  const r = importBackup(db, merged, 'merge');
  return { added: r.totalInserted };
}
