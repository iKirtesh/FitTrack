import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, pk, updatedAt } from './common';

export const muscleGroups = sqliteTable('muscle_groups', {
  id: text('id').primaryKey(), // stable slug, e.g. 'chest'
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const exercises = sqliteTable(
  'exercises',
  {
    id: pk(),
    name: text('name').notNull(),
    muscleGroupId: text('muscle_group_id')
      .notNull()
      .references(() => muscleGroups.id, { onDelete: 'restrict' }),
    secondaryMuscles: text('secondary_muscles').notNull().default('[]'), // JSON string[] of muscle group ids
    equipment: text('equipment').notNull(),
    instructions: text('instructions'),
    imageUri: text('image_uri'),
    difficulty: text('difficulty').notNull().default('intermediate'),
    exerciseType: text('exercise_type').notNull().default('strength'), // strength | cardio | mobility
    trackingType: text('tracking_type').notNull(), // see constants/exercise
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    /** Stable key for seeded exercises so reseeding never duplicates. Null for custom ones. */
    seedKey: text('seed_key'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('exercises_muscle_idx').on(t.muscleGroupId),
    index('exercises_name_idx').on(t.name),
    uniqueIndex('exercises_seed_key_uq').on(t.seedKey),
  ],
);
