export interface BuiltInCounter {
  key: string;
  name: string;
  unit: string;
  step: number;
  dailyTarget: number | null;
}

/**
 * Seeded counters. "Steps", distance and workout counts are NOT counters here: steps live in
 * daily_activity and distances/workout counts are derived from recorded sessions, so a counter
 * never claims automatic tracking it does not do.
 */
export const BUILT_IN_COUNTERS: BuiltInCounter[] = [
  { key: 'pushups', name: 'Push-ups', unit: 'reps', step: 1, dailyTarget: 50 },
  { key: 'pullups', name: 'Pull-ups', unit: 'reps', step: 1, dailyTarget: 20 },
  { key: 'squats', name: 'Squats', unit: 'reps', step: 1, dailyTarget: 50 },
  { key: 'situps', name: 'Sit-ups', unit: 'reps', step: 1, dailyTarget: 50 },
  { key: 'jump_rope', name: 'Jump rope', unit: 'jumps', step: 10, dailyTarget: 500 },
  { key: 'plank', name: 'Plank', unit: 'sec', step: 10, dailyTarget: 120 },
  { key: 'water', name: 'Water', unit: 'ml', step: 250, dailyTarget: 2500 },
];
