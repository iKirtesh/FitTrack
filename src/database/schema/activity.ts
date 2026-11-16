import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, pk, updatedAt } from './common';

/** One row per local day. Steps are manual or pedometer-sourced; `stepsSource` says which. */
export const dailyActivity = sqliteTable('daily_activity', {
  date: text('date').primaryKey(),
  steps: integer('steps').notNull().default(0),
  stepsSource: text('steps_source').notNull().default('manual'), // manual | pedometer
  caloriesEstimate: integer('calories_estimate'),
  waterMl: integer('water_ml').notNull().default(0),
  updatedAt: updatedAt(),
});

export const activityCounters = sqliteTable(
  'activity_counters',
  {
    id: pk(),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('reps'),
    step: real('step').notNull().default(1),
    dailyTarget: real('daily_target'),
    isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
    builtInKey: text('built_in_key'),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('counter_builtin_uq').on(t.builtInKey)],
);

/** Append-only log; the daily total is the sum of deltas. Reset/undo write compensating rows. */
export const counterEntries = sqliteTable(
  'counter_entries',
  {
    id: pk(),
    counterId: text('counter_id')
      .notNull()
      .references(() => activityCounters.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    delta: real('delta').notNull(),
    recordedAt: integer('recorded_at').notNull(),
  },
  (t) => [index('counter_entries_idx').on(t.counterId, t.date)],
);
