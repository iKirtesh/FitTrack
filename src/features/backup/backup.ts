import { eq, like, not, sql } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/database/schema';
import { seedReferenceData } from '@/database/seed';
import { recordsRepo } from '@/database/repositories/records';
import { achievementsRepo } from '@/database/repositories/achievements';
import { BACKUP_TABLES, SECURITY_SETTING_PREFIX, columnsOf } from './tables';
import { toCsv } from '@/utils/csv';
import { localDay } from '@/utils/dates';
import type { AppDb } from '@/types/db';

export const BACKUP_APP = 'fittrack';
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: number;
  tables: Record<string, Record<string, unknown>[]>;
}

const envelope = z.object({
  app: z.literal(BACKUP_APP, { error: 'This is not a FitTrack backup file' }),
  formatVersion: z.number().int(),
  exportedAt: z.number(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export function exportAll(db: AppDb, now: number = Date.now()): BackupFile {
  const tables: BackupFile['tables'] = {};
  for (const bt of BACKUP_TABLES) {
    let q = db.select().from(bt.table as never) as unknown as { where: (c: unknown) => unknown; all: () => Record<string, unknown>[] };
    if (bt.where === 'custom_exercises') q = q.where(eq(s.exercises.isCustom, true)) as typeof q;
    if (bt.where === 'no_security_settings') q = q.where(not(like(s.appSettings.key, `${SECURITY_SETTING_PREFIX}%`))) as typeof q;
    tables[bt.key] = q.all();
  }
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT, exportedAt: now, tables };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Rows in the file, per table. */
  counts: Record<string, number>;
  exportedAt: number | null;
}

/** Structural validation only: shape, known columns, required fields and value types. Does not touch the database. */
export function validateBackup(input: unknown): ValidationResult {
  const errors: string[] = [];
  const parsed = envelope.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: [parsed.error.issues[0]?.message ?? 'Not a valid backup file'], counts: {}, exportedAt: null };
  }
  const file = parsed.data;
  if (file.formatVersion > BACKUP_FORMAT) {
    return { ok: false, errors: [`This backup was made by a newer version of FitTrack (format ${file.formatVersion}). Update the app to restore it.`], counts: {}, exportedAt: file.exportedAt };
  }
  const known = new Set(BACKUP_TABLES.map((t) => t.key));
  for (const k of Object.keys(file.tables)) if (!known.has(k)) errors.push(`Unknown table "${k}"`);

  const counts: Record<string, number> = {};
  for (const bt of BACKUP_TABLES) {
    const rows = file.tables[bt.key] ?? [];
    counts[bt.key] = rows.length;
    const cols = columnsOf(bt.table);
    const byProp = new Map(cols.map((c) => [c.prop, c]));
    rows.forEach((row, i) => {
      if (errors.length >= 20) return;
      for (const k of Object.keys(row)) if (!byProp.has(k)) errors.push(`${bt.key}[${i}]: unknown field "${k}"`);
      for (const c of cols) {
        const v = row[c.prop];
        if (v == null) {
          if (c.required) errors.push(`${bt.key}[${i}]: missing required field "${c.prop}"`);
          continue;
        }
        const t = typeof v;
        if (c.kind === 'number' && !(t === 'number' && Number.isFinite(v as number))) errors.push(`${bt.key}[${i}].${c.prop} must be a number`);
        else if (c.kind === 'string' && t !== 'string') errors.push(`${bt.key}[${i}].${c.prop} must be text`);
        else if (c.kind === 'boolean' && t !== 'boolean') errors.push(`${bt.key}[${i}].${c.prop} must be true or false`);
      }
    });
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 20), counts, exportedAt: file.exportedAt };
}

export interface ImportResult {
  inserted: Record<string, number>;
  duplicates: Record<string, number>;
  totalInserted: number;
  totalDuplicates: number;
}

export type RestoreMode = 'merge' | 'replace';

/**
 * Restores a backup in ONE transaction: if anything fails, nothing is changed.
 * - merge: rows that already exist (same primary key, or the same unique import key) are skipped and counted as duplicates.
 * - replace: all current user data is removed first, then the backup is loaded.
 * Throws with a readable message if the file is invalid or references data that does not exist.
 */
export function importBackup(db: AppDb, input: unknown, mode: RestoreMode = 'merge'): ImportResult {
  const v = validateBackup(input);
  if (!v.ok) throw new Error(`Backup is not valid: ${v.errors[0]}`);
  const file = input as BackupFile;

  // Friendly pre-check for the most likely dangling reference: custom/built-in exercises used by sessions.
  const exerciseIds = new Set<string>(db.select({ id: s.exercises.id }).from(s.exercises).all().map((e) => e.id));
  if (mode === 'replace') for (const id of [...exerciseIds]) if (!id.startsWith('seed_')) exerciseIds.delete(id);
  for (const e of file.tables.exercises ?? []) exerciseIds.add(String(e.id));
  for (const key of ['workoutExercises', 'workoutPlanExercises'] as const) {
    for (const r of file.tables[key] ?? []) {
      if (!exerciseIds.has(String(r.exerciseId))) throw new Error('Backup references an exercise that does not exist in this version of the app');
    }
  }

  const inserted: Record<string, number> = {};
  const duplicates: Record<string, number> = {};
  db.transaction((tx) => {
    if (mode === 'replace') clearUserData(tx as unknown as AppDb);
    for (const bt of BACKUP_TABLES) {
      const rows = file.tables[bt.key] ?? [];
      inserted[bt.key] = 0;
      duplicates[bt.key] = 0;
      for (const raw of rows) {
        const row = { ...raw };
        if (bt.key === 'gpsRoutePoints') delete row.id; // autoincrement; (session, seq) is the natural key
        const res = (tx.insert(bt.table as never) as unknown as { values: (v: unknown) => { onConflictDoNothing: () => { run: () => { changes: number } } } })
          .values(row).onConflictDoNothing().run();
        if (res.changes > 0) inserted[bt.key]! += 1; else duplicates[bt.key]! += 1;
      }
    }
    // A restored in-progress workout/run would be confusing; keep it, the UI offers resume/discard.
  });
  recordsRepo(db).rebuild();
  achievementsRepo(db).evaluate();
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { inserted, duplicates, totalInserted: sum(inserted), totalDuplicates: sum(duplicates) };
}

/** Deletes every user-created row. Reference data (muscle groups, built-in exercises) is untouched. */
function clearUserData(db: AppDb): void {
  for (const bt of [...BACKUP_TABLES].reverse()) {
    if (bt.key === 'exercises') db.delete(s.exercises).where(eq(s.exercises.isCustom, true)).run();
    else if (bt.key === 'activityCounters') db.delete(s.activityCounters).where(eq(s.activityCounters.isBuiltIn, false)).run();
    else db.delete(bt.table as never).run();
  }
  db.delete(s.personalRecords).run();
}

/**
 * Removes ALL user data and returns the database to a fresh-install state (reference data reseeded).
 * Built-in counters are kept but reset to defaults, with their history removed.
 */
export function deleteAllData(db: AppDb, now: number = Date.now()): void {
  db.transaction((tx) => {
    const t = tx as unknown as AppDb;
    clearUserData(t);
    t.delete(s.activityCounters).run();
  });
  seedReferenceData(db, now);
}

// ---------------------------------------------------------------- CSV

export interface CsvExport { filename: string; content: string }

/** Workout history, one row per completed set, plus runs, cardio and measurements as separate files. */
export function exportCsv(db: AppDb, today: string = localDay()): CsvExport[] {
  const sets = db
    .select({
      date: s.workoutSessions.date, workout: s.workoutSessions.name, startedAt: s.workoutSessions.startedAt, durationSec: s.workoutSessions.durationSec,
      rpe: s.workoutSessions.rpe, exercise: s.exercises.name, setOrder: s.workoutSets.setOrder, kind: s.workoutSets.kind,
      weightKg: s.workoutSets.weightKg, reps: s.workoutSets.reps, setDuration: s.workoutSets.durationSec, distanceM: s.workoutSets.distanceM,
      completed: s.workoutSets.isCompleted,
    })
    .from(s.workoutSets)
    .innerJoin(s.workoutExercises, eq(s.workoutSets.workoutExerciseId, s.workoutExercises.id))
    .innerJoin(s.workoutSessions, eq(s.workoutExercises.sessionId, s.workoutSessions.id))
    .innerJoin(s.exercises, eq(s.workoutExercises.exerciseId, s.exercises.id))
    .where(eq(s.workoutSessions.status, 'completed'))
    .orderBy(s.workoutSessions.startedAt, s.workoutExercises.position, s.workoutSets.setOrder)
    .all();

  const workouts = toCsv(
    ['date', 'workout', 'workout_duration_sec', 'workout_rpe', 'exercise', 'set', 'set_type', 'weight_kg', 'reps', 'set_duration_sec', 'distance_m', 'completed'],
    sets.map((r) => [r.date, r.workout, r.durationSec, r.rpe, r.exercise, r.setOrder, r.kind, r.weightKg, r.reps, r.setDuration, r.distanceM, r.completed ? 'yes' : 'no']),
  );
  const runs = db.select().from(s.runningSessions).where(eq(s.runningSessions.status, 'completed')).orderBy(s.runningSessions.startedAt).all();
  const cardio = db.select().from(s.cardioSessions).orderBy(s.cardioSessions.startedAt).all();
  const meas = db.select().from(s.bodyMeasurements).orderBy(s.bodyMeasurements.date).all();
  return [
    { filename: `fittrack-workouts-${today}.csv`, content: workouts },
    {
      filename: `fittrack-runs-${today}.csv`,
      content: toCsv(['date', 'activity', 'duration_sec', 'distance_m', 'avg_pace_sec_per_km', 'elevation_gain_m', 'steps', 'calories_estimate', 'source', 'notes'],
        runs.map((r) => [r.date, r.activityType, r.durationSec, r.distanceM, r.avgPaceSecPerKm, r.elevationGainM, r.steps, r.caloriesEstimate, r.source, r.notes])),
    },
    {
      filename: `fittrack-cardio-${today}.csv`,
      content: toCsv(['date', 'activity', 'duration_sec', 'distance_m', 'calories', 'avg_heart_rate', 'intensity', 'notes'],
        cardio.map((r) => [r.date, r.customName ?? r.activityType, r.durationSec, r.distanceM, r.caloriesEstimate, r.avgHeartRate, r.intensity, r.notes])),
    },
    {
      filename: `fittrack-measurements-${today}.csv`,
      content: toCsv(['date', 'weight_kg', 'body_fat_pct', 'chest_cm', 'waist_cm', 'hips_cm', 'arms_cm', 'forearms_cm', 'thighs_cm', 'calves_cm', 'neck_cm', 'notes'],
        meas.map((m) => [m.date, m.weightKg, m.bodyFatPct, m.chestCm, m.waistCm, m.hipsCm, m.armsCm, m.forearmsCm, m.thighsCm, m.calvesCm, m.neckCm, m.notes])),
    },
  ];
}

/** Row counts of everything that would be removed, shown in the delete-confirmation dialog. */
export function dataSummary(db: AppDb) {
  const n = (t: Table) => (db.select({ n: sql<number>`count(*)` }).from(t as never) as unknown as { get: () => { n: number } | undefined }).get()?.n ?? 0;
  return {
    workouts: n(s.workoutSessions), runs: n(s.runningSessions), cardio: n(s.cardioSessions), measurements: n(s.bodyMeasurements),
    plans: n(s.workoutPlans), counterEntries: n(s.counterEntries), hasProfile: n(s.userProfiles) > 0,
  };
}
