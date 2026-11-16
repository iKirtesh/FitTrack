export const MUSCLE_GROUPS = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'forearms', name: 'Forearms' },
  { id: 'legs', name: 'Legs' },
  { id: 'quadriceps', name: 'Quadriceps' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'glutes', name: 'Glutes' },
  { id: 'calves', name: 'Calves' },
  { id: 'abs', name: 'Abs' },
  { id: 'core', name: 'Core' },
  { id: 'full_body', name: 'Full body' },
] as const;
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]['id'];

export const EQUIPMENT = [
  'dumbbells',
  'barbell',
  'machine',
  'cable',
  'resistance_band',
  'bodyweight',
  'kettlebell',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  dumbbells: 'Dumbbells',
  barbell: 'Barbell',
  machine: 'Machine',
  cable: 'Cable',
  resistance_band: 'Resistance band',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  other: 'Other',
};

export const DIFFICULTY = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTY)[number];

export const EXERCISE_TYPES = ['strength', 'cardio', 'mobility'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/**
 * How sets of an exercise are recorded.
 * - weight_reps: weight x reps (bench press)
 * - bodyweight_reps: reps only (push-up)
 * - assisted: reps with assistance weight, which is subtracted from bodyweight (assisted pull-up)
 * - timed: duration only (plank)
 * - distance: distance (+ optional duration) (farmer's walk, sled push)
 * - duration: alias-free long-form cardio style duration, e.g. 20 min bike
 */
export const TRACKING_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'assisted',
  'timed',
  'distance',
  'duration',
] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const TRACKING_LABEL: Record<TrackingType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  assisted: 'Assisted',
  timed: 'Timed',
  distance: 'Distance',
  duration: 'Duration',
};

export const SET_KINDS = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetKind = (typeof SET_KINDS)[number];
