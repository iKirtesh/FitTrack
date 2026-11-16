import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import * as s from '@/database/schema';

export interface BackupTable {
  key: string;
  table: Table;
  /** Exported only where this predicate holds (e.g. custom exercises; built-ins ship with the app). */
  where?: 'custom_exercises' | 'no_security_settings';
}

/**
 * Parents before children, which is also a valid insert order. Reverse it for deletes.
 * `personal_records` is intentionally absent: it is derived data, rebuilt after every import.
 * `muscle_groups` is absent: it is reference data that ships with the app.
 */
export const BACKUP_TABLES: BackupTable[] = [
  { key: 'userProfiles', table: s.userProfiles },
  { key: 'exercises', table: s.exercises, where: 'custom_exercises' },
  { key: 'workoutPlans', table: s.workoutPlans },
  { key: 'workoutPlanExercises', table: s.workoutPlanExercises },
  { key: 'workoutSessions', table: s.workoutSessions },
  { key: 'workoutExercises', table: s.workoutExercises },
  { key: 'workoutSets', table: s.workoutSets },
  { key: 'cardioSessions', table: s.cardioSessions },
  { key: 'runningSessions', table: s.runningSessions },
  { key: 'runningSplits', table: s.runningSplits },
  { key: 'gpsRoutePoints', table: s.gpsRoutePoints },
  { key: 'dailyActivity', table: s.dailyActivity },
  { key: 'activityCounters', table: s.activityCounters },
  { key: 'counterEntries', table: s.counterEntries },
  { key: 'bodyMeasurements', table: s.bodyMeasurements },
  { key: 'fitnessGoals', table: s.fitnessGoals },
  { key: 'achievements', table: s.achievements },
  { key: 'reminders', table: s.reminders },
  { key: 'appSettings', table: s.appSettings, where: 'no_security_settings' },
];

/** Settings under this prefix (app-lock state) are never exported, so a backup can't carry a PIN hash. */
export const SECURITY_SETTING_PREFIX = 'security.';

export interface ColumnInfo { prop: string; column: SQLiteColumn; required: boolean; kind: 'string' | 'number' | 'boolean' }

export function columnsOf(t: Table): ColumnInfo[] {
  return Object.entries(getTableColumns(t)).map(([prop, col]) => {
    const c = col as SQLiteColumn;
    const dt = c.dataType as string;
    return {
      prop, column: c,
      required: c.notNull && !c.hasDefault && !c.primary || (c.primary && !c.hasDefault && dt !== 'number'),
      kind: dt === 'boolean' ? 'boolean' : dt === 'number' ? 'number' : 'string',
    };
  });
}

export const tableName = (t: Table) => getTableName(t);
