import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, pk, updatedAt } from './common';
import { exercises } from './exercises';

export const workoutPlans = sqliteTable('workout_plans', {
  id: pk(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One row per exercise per plan-day. `dayOfWeek` 0=Sunday..6=Saturday, null = unscheduled template. */
export const workoutPlanExercises = sqliteTable(
  'workout_plan_exercises',
  {
    id: pk(),
    planId: text('plan_id')
      .notNull()
      .references(() => workoutPlans.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week'),
    dayName: text('day_name'),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    targetReps: integer('target_reps'),
    targetWeightKg: real('target_weight_kg'),
    targetDurationSec: integer('target_duration_sec'),
    targetDistanceM: real('target_distance_m'),
    restSec: integer('rest_sec').notNull().default(90),
  },
  (t) => [
    index('wpe_plan_idx').on(t.planId, t.dayOfWeek, t.position),
    index('wpe_exercise_idx').on(t.exerciseId),
  ],
);

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: pk(),
    name: text('name').notNull(),
    planId: text('plan_id').references(() => workoutPlans.id, { onDelete: 'set null' }),
    date: text('date').notNull(), // YYYY-MM-DD local day
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    durationSec: integer('duration_sec'),
    status: text('status').notNull().default('in_progress'), // in_progress | completed | discarded
    rpe: real('rpe'), // 1-10
    notes: text('notes'),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    /** Denormalised for fast history lists; recomputed on finish. */
    setCount: integer('set_count').notNull().default(0),
    caloriesEstimate: integer('calories_estimate'),
    importHash: text('import_hash'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('ws_date_idx').on(t.date),
    index('ws_status_idx').on(t.status),
    uniqueIndex('ws_import_hash_uq').on(t.importHash),
  ],
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: pk(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    restSec: integer('rest_sec').notNull().default(90),
    notes: text('notes'),
  },
  (t) => [
    index('we_session_idx').on(t.sessionId, t.position),
    index('we_exercise_idx').on(t.exerciseId),
  ],
);

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: pk(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    setOrder: integer('set_order').notNull(),
    kind: text('kind').notNull().default('normal'), // normal | warmup | drop | failure
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at'),
  },
  (t) => [uniqueIndex('wset_order_uq').on(t.workoutExerciseId, t.setOrder)],
);
