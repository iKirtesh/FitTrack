import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';
import { seedReferenceData } from './seed';
import type { AppDb } from '@/types/db';

export const DB_NAME = 'fittrack.db';

let instance: { db: AppDb; sqlite: SQLite.SQLiteDatabase } | null = null;
let ready: Promise<AppDb> | null = null;

function open() {
  if (instance) return instance;
  const sqlite = SQLite.openDatabaseSync(DB_NAME);
  // Foreign keys are off by default in SQLite and must be enabled per connection.
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  // WAL gives crash-safe, faster writes on native. The wasm/web build does not support it.
  if (Platform.OS !== 'web') sqlite.execSync('PRAGMA journal_mode = WAL;');
  const db = drizzle(sqlite, { schema }) as unknown as AppDb;
  instance = { db, sqlite };
  return instance;
}

/**
 * Applies pending migrations. On a brand-new web (WASM) database the very first transaction can fail
 * transiently ("cannot rollback - no transaction is active"). A failed attempt leaves nothing applied
 * and migrations are idempotent, so a short bounded retry is safe. All attempt errors are kept so a
 * persistent failure still reports what actually went wrong.
 */
async function migrateWithRetry(db: AppDb, attempts = 4): Promise<void> {
  const errors: string[] = [];
  for (let i = 0; i < attempts; i++) {
    try {
      await migrate(db as never, migrations);
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw new Error(`Migration failed after ${attempts} attempts: ${errors.join(' | ')}`);
}

/**
 * Opens the database, applies any pending migrations and seeds reference data.
 * Idempotent: concurrent callers share one initialisation. If migration fails the
 * promise rejects and the app shows an error screen rather than running on a
 * half-migrated schema; existing data is never dropped.
 */
export function initDatabase(): Promise<AppDb> {
  if (!ready) {
    ready = (async () => {
      // expo-sqlite on web runs SQLite (WASM) in a worker and its *sync* calls busy-wait on the main
      // thread, which starves the worker while it is still starting up ("Sync operation timeout").
      // One async open first lets the worker finish loading; after that sync calls return promptly.
      // A throwaway in-memory database is used so the real database only ever has one connection.
      if (Platform.OS === 'web') await (await SQLite.openDatabaseAsync(':memory:')).closeAsync();
      const { db } = open();
      await migrateWithRetry(db);
      seedReferenceData(db);
      return db;
    })().catch((e) => {
      ready = null; // allow retry
      throw e;
    });
  }
  return ready;
}

export function getDb(): AppDb {
  if (!instance || !ready) throw new Error('Database not initialised. Wrap the app in <DatabaseProvider>.');
  return instance.db;
}

/** Closes and deletes the database file, then reinitialises an empty one. Used by "delete all data". */
export async function wipeAndReinitialise(): Promise<void> {
  const current = instance;
  instance = null;
  ready = null;
  if (current) {
    await current.sqlite.closeAsync();
    await SQLite.deleteDatabaseAsync(DB_NAME);
  }
  await initDatabase();
}
