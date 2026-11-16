import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { pk } from './common';

/**
 * Personal records are derived from recorded data but stored so the history of
 * when a record was set survives later deletions being recomputed transparently.
 * `sourceType`/`sourceId` always point at the real session the value came from.
 */
export const personalRecords = sqliteTable(
  'personal_records',
  {
    id: pk(),
    kind: text('kind').notNull(), // max_weight | max_reps | max_volume_set | longest_run | fastest_5k | longest_workout | best_week_distance | best_streak ...
    subjectId: text('subject_id'), // exercise id for lifting records, null otherwise
    value: real('value').notNull(),
    unit: text('unit').notNull(),
    sourceType: text('source_type').notNull(), // workout_session | running_session | derived
    sourceId: text('source_id'),
    achievedAt: integer('achieved_at').notNull(),
    date: text('date').notNull(),
  },
  (t) => [
    uniqueIndex('pr_kind_subject_uq').on(t.kind, t.subjectId),
    index('pr_date_idx').on(t.date),
  ],
);

export const achievements = sqliteTable('achievements', {
  /** Stable key from constants/achievements; the definition lives in code, only unlock state is stored. */
  key: text('key').primaryKey(),
  unlockedAt: integer('unlocked_at').notNull(),
  /** Human-readable evidence, e.g. "Completed 10 workouts". */
  evidence: text('evidence'),
});

export const reminders = sqliteTable(
  'reminders',
  {
    id: pk(),
    kind: text('kind').notNull(), // workout | activity | water | weight | goal
    title: text('title').notNull(),
    body: text('body'),
    hour: integer('hour').notNull(),
    minute: integer('minute').notNull(),
    daysOfWeek: text('days_of_week').notNull().default('[0,1,2,3,4,5,6]'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    /** Native notification identifiers, JSON string[]; empty on web. */
    notificationIds: text('notification_ids').notNull().default('[]'),
  },
  (t) => [index('reminders_kind_idx').on(t.kind)],
);
