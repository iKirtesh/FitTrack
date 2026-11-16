export const GOALS = [
  { id: 'weight_loss', label: 'Weight loss' },
  { id: 'muscle_building', label: 'Muscle building' },
  { id: 'strength', label: 'Strength development' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'general_fitness', label: 'General fitness' },
  { id: 'recomposition', label: 'Body recomposition' },
  { id: 'athletic_performance', label: 'Athletic performance' },
] as const;
export type GoalId = (typeof GOALS)[number]['id'];

export const EXPERIENCE = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
] as const;
export type ExperienceId = (typeof EXPERIENCE)[number]['id'];

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  { id: 'light', label: 'Lightly active', hint: '1-3 workouts a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', hint: '3-5 workouts a week', factor: 1.55 },
  { id: 'high', label: 'Very active', hint: '6-7 workouts a week', factor: 1.725 },
  { id: 'athlete', label: 'Athlete', hint: 'Twice-daily or physical job', factor: 1.9 },
] as const;
export type ActivityLevelId = (typeof ACTIVITY_LEVELS)[number]['id'];

export const WORKOUT_TYPES = [
  { id: 'strength', label: 'Strength training' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'running', label: 'Running / walking' },
  { id: 'mixed', label: 'A mix' },
] as const;

export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'non_binary', label: 'Non-binary' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';
