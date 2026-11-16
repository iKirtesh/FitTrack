import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, pk, updatedAt } from './common';

/** Exactly one row is expected (single local user), enforced by the repository. */
export const userProfiles = sqliteTable('user_profiles', {
  id: pk(),
  fullName: text('full_name').notNull(),
  photoUri: text('photo_uri'),
  dateOfBirth: text('date_of_birth'), // YYYY-MM-DD
  gender: text('gender'), // 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  targetWeightKg: real('target_weight_kg'),
  experience: text('experience').notNull().default('beginner'),
  goal: text('goal').notNull().default('general_fitness'),
  activityLevel: text('activity_level').notNull().default('moderate'),
  preferredWorkoutType: text('preferred_workout_type'),
  preferredWorkoutDays: text('preferred_workout_days').notNull().default('[]'), // JSON number[] (0=Sun)
  weightUnit: text('weight_unit').notNull().default('kg'),
  distanceUnit: text('distance_unit').notNull().default('km'),
  dailyStepTarget: integer('daily_step_target').notNull().default(8000),
  dailyCalorieTarget: integer('daily_calorie_target'),
  dailyWaterTargetMl: integer('daily_water_target_ml').notNull().default(2500),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const fitnessGoals = sqliteTable('fitness_goals', {
  id: pk(),
  type: text('type').notNull(), // 'weight' (kg) | 'workouts_per_week' (count) | 'weekly_distance' (metres)
  title: text('title').notNull(),
  targetValue: real('target_value').notNull(),
  startValue: real('start_value'),
  unit: text('unit'),
  deadline: text('deadline'),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'abandoned'
  completedAt: integer('completed_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON-encoded
  updatedAt: updatedAt(),
});

/** Single-row metadata used for backups and migrations bookkeeping. */
export const schemaMeta = sqliteTable('schema_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
