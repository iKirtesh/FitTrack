import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/database/schema';
import { seedReferenceData } from '@/database/seed';
import type { AppDb } from '@/types/db';

/** A real SQLite database, migrated with the same SQL files the app ships. */
export function createTestDb(opts: { seed?: boolean } = {}): { db: AppDb; sqlite: Database.Database } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../database/migrations') });
  if (opts.seed !== false) seedReferenceData(db as unknown as AppDb);
  return { db: db as unknown as AppDb, sqlite };
}

export const validProfile = {
  fullName: 'Test User',
  dateOfBirth: '1995-06-15',
  gender: 'male' as const,
  heightCm: 178,
  weightKg: 80,
  targetWeightKg: 75,
  experience: 'intermediate' as const,
  goal: 'muscle_building' as const,
  activityLevel: 'moderate' as const,
  preferredWorkoutType: 'strength' as const,
  preferredWorkoutDays: [1, 3, 5],
  weightUnit: 'kg' as const,
  distanceUnit: 'km' as const,
  dailyStepTarget: 8000,
  dailyCalorieTarget: 2600,
  dailyWaterTargetMl: 2500,
};
