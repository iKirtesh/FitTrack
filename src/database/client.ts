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
 * Opens the database, applies any pending migrations and seeds reference data.
 * Idempotent: concurrent callers share one initialisation. If migration fails the
 * promise rejects and the app shows an error screen rather than running on a
 * half-migrated schema; existing data is never dropped.
 */
export function initDatabase(): Promise<AppDb> {
  if (!ready) {
    ready = (async () => {
      const { db } = open();
      await migrate(db as never, migrations);
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
