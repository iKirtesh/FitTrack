import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from '@/database/schema';

/**
 * Both expo-sqlite (app) and better-sqlite3 (tests) are synchronous drivers, so
 * repositories are written once against this type and run unchanged in both.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;
export type Tx = Parameters<Parameters<AppDb['transaction']>[0]>[0];
