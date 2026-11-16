import { z } from 'zod';
import { EQUIPMENT, DIFFICULTY, TRACKING_TYPES, MUSCLE_GROUPS } from '@/constants/exercise';
import { isValidDay, ageFromDob } from '@/utils/dates';

const positive = (label: string, max: number) =>
  z.number({ error: `${label} is required` }).positive(`${label} must be positive`).max(max, `${label} looks too large`);

const optionalPositive = (label: string, max: number) => positive(label, max).nullable().optional();

const day = z.string().refine(isValidDay, 'Use a valid date (YYYY-MM-DD)');

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(80),
  photoUri: z.string().nullable().optional(),
  dateOfBirth: day
    .refine((d) => {
      const a = ageFromDob(d);
      return a >= 10 && a <= 110;
    }, 'Age must be between 10 and 110')
    .nullable()
    .optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).nullable().optional(),
  heightCm: optionalPositive('Height', 272),
  weightKg: optionalPositive('Weight', 500),
  targetWeightKg: optionalPositive('Target weight', 500),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: z.enum([
    'weight_loss', 'muscle_building', 'strength', 'endurance', 'general_fitness', 'recomposition', 'athletic_performance',
  ]),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high', 'athlete']),
  preferredWorkoutType: z.enum(['strength', 'cardio', 'running', 'mixed']).nullable().optional(),
  preferredWorkoutDays: z.array(z.number().int().min(0).max(6)).max(7),
  weightUnit: z.enum(['kg', 'lb']),
  distanceUnit: z.enum(['km', 'mi']),
  dailyStepTarget: z.number().int().min(0).max(100_000),
  dailyCalorieTarget: z.number().int().min(500).max(10_000).nullable().optional(),
  dailyWaterTargetMl: z.number().int().min(0).max(10_000),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  muscleGroupId: z.enum(MUSCLE_GROUPS.map((m) => m.id) as [string, ...string[]]),
  secondaryMuscles: z.array(z.string()).max(6).default([]),
  equipment: z.enum(EQUIPMENT),
  instructions: z.string().max(2000).nullable().optional(),
  difficulty: z.enum(DIFFICULTY).default('intermediate'),
  trackingType: z.enum(TRACKING_TYPES),
});
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export const measurementSchema = z
  .object({
    date: day,
    weightKg: optionalPositive('Weight', 500),
    bodyFatPct: z.number().min(2, 'Body fat looks too low').max(75, 'Body fat looks too high').nullable().optional(),
    chestCm: optionalPositive('Chest', 300),
    waistCm: optionalPositive('Waist', 300),
    hipsCm: optionalPositive('Hips', 300),
    armsCm: optionalPositive('Arms', 100),
    forearmsCm: optionalPositive('Forearms', 80),
    thighsCm: optionalPositive('Thighs', 150),
    calvesCm: optionalPositive('Calves', 100),
    neckCm: optionalPositive('Neck', 80),
    photoUri: z.string().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine(
    (m) =>
      [m.weightKg, m.bodyFatPct, m.chestCm, m.waistCm, m.hipsCm, m.armsCm, m.forearmsCm, m.thighsCm, m.calvesCm, m.neckCm, m.photoUri].some(
        (v) => v != null,
      ),
    { message: 'Enter at least one measurement', path: ['weightKg'] },
  );
export type MeasurementInput = z.infer<typeof measurementSchema>;

export const manualRunSchema = z.object({
  activityType: z.enum(['outdoor_run', 'indoor_run', 'walk', 'outdoor_walk', 'treadmill', 'hike']),
  date: day,
  startedAt: z.number().int().positive(),
  durationSec: z.number().int().positive('Duration is required').max(24 * 3600),
  distanceM: positive('Distance', 500_000),
  elevationGainM: z.number().min(0).max(9000).nullable().optional(),
  steps: z.number().int().min(0).max(200_000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type ManualRunInput = z.infer<typeof manualRunSchema>;

export const cardioSchema = z.object({
  activityType: z.string().min(1),
  customName: z.string().trim().max(60).nullable().optional(),
  date: day,
  startedAt: z.number().int().positive(),
  durationSec: z.number().int().positive('Duration is required').max(24 * 3600),
  distanceM: z.number().min(0).max(1_000_000).nullable().optional(),
  avgHeartRate: z.number().int().min(30).max(240).nullable().optional(),
  maxHeartRate: z.number().int().min(30).max(250).nullable().optional(),
  intensity: z.enum(['low', 'moderate', 'high']).nullable().optional(),
  caloriesEstimate: z.number().int().min(0).max(20_000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type CardioInput = z.infer<typeof cardioSchema>;

export const counterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  unit: z.string().trim().min(1).max(12),
  step: z.number().positive().max(100_000),
  dailyTarget: z.number().positive().max(10_000_000).nullable().optional(),
});
export type CounterInput = z.infer<typeof counterSchema>;

export const reminderSchema = z.object({
  kind: z.enum(['workout', 'activity', 'water', 'weight', 'goal']),
  title: z.string().trim().min(1).max(60),
  body: z.string().max(200).nullable().optional(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
});
export type ReminderInput = z.infer<typeof reminderSchema>;

export const goalSchema = z.object({
  type: z.enum(['weight', 'workouts_per_week', 'weekly_distance', 'custom']),
  title: z.string().trim().min(1).max(80),
  targetValue: z.number().finite(),
  startValue: z.number().finite().nullable().optional(),
  unit: z.string().max(12).nullable().optional(),
  deadline: day.nullable().optional(),
});
export type GoalInput = z.infer<typeof goalSchema>;
