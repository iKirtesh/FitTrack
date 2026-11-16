import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, pk } from './common';

export const cardioSessions = sqliteTable(
  'cardio_sessions',
  {
    id: pk(),
    activityType: text('activity_type').notNull(), // slug from constants, or 'custom'
    customName: text('custom_name'),
    date: text('date').notNull(),
    startedAt: integer('started_at').notNull(),
    durationSec: integer('duration_sec').notNull(),
    distanceM: real('distance_m'),
    caloriesEstimate: integer('calories_estimate'),
    avgSpeedMps: real('avg_speed_mps'),
    avgHeartRate: integer('avg_heart_rate'),
    maxHeartRate: integer('max_heart_rate'),
    intensity: text('intensity'), // low | moderate | high
    notes: text('notes'),
    importHash: text('import_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('cardio_date_idx').on(t.date), uniqueIndex('cardio_import_hash_uq').on(t.importHash)],
);

export const runningSessions = sqliteTable(
  'running_sessions',
  {
    id: pk(),
    activityType: text('activity_type').notNull(), // outdoor_run | indoor_run | walk | outdoor_walk | treadmill | hike
    date: text('date').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    durationSec: integer('duration_sec').notNull().default(0),
    movingTimeSec: integer('moving_time_sec'),
    distanceM: real('distance_m').notNull().default(0),
    avgPaceSecPerKm: real('avg_pace_sec_per_km'),
    fastestPaceSecPerKm: real('fastest_pace_sec_per_km'),
    avgSpeedMps: real('avg_speed_mps'),
    elevationGainM: real('elevation_gain_m'),
    steps: integer('steps'),
    caloriesEstimate: integer('calories_estimate'),
    /** 'gps' when the route was recorded on-device, 'manual' when the user typed the numbers in. */
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('completed'), // in_progress | completed
    notes: text('notes'),
    importHash: text('import_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    index('run_date_idx').on(t.date),
    index('run_status_idx').on(t.status),
    uniqueIndex('run_import_hash_uq').on(t.importHash),
  ],
);

export const runningSplits = sqliteTable(
  'running_splits',
  {
    id: pk(),
    sessionId: text('session_id')
      .notNull()
      .references(() => runningSessions.id, { onDelete: 'cascade' }),
    splitIndex: integer('split_index').notNull(), // 1-based
    distanceM: real('distance_m').notNull(),
    durationSec: real('duration_sec').notNull(),
    paceSecPerKm: real('pace_sec_per_km').notNull(),
  },
  (t) => [uniqueIndex('split_session_idx_uq').on(t.sessionId, t.splitIndex)],
);

export const gpsRoutePoints = sqliteTable(
  'gps_route_points',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('session_id')
      .notNull()
      .references(() => runningSessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    altitudeM: real('altitude_m'),
    accuracyM: real('accuracy_m'),
    speedMps: real('speed_mps'),
    recordedAt: integer('recorded_at').notNull(),
  },
  (t) => [uniqueIndex('gps_session_seq_uq').on(t.sessionId, t.seq)],
);
