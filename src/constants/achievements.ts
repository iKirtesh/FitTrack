/**
 * Every achievement is a pure function of recorded data, and `describe` states the exact rule so
 * the user can see why it was (or was not) earned.
 */
export interface AchievementStats {
  workouts: number;
  runs: number;
  runDistanceM: number;
  cardioSessions: number;
  totalVolumeKg: number;
  longestStreakDays: number;
  prCount: number;
  measurements: number;
  weightGoalReached: boolean;
  longestRunM: number;
  fiveKDone: boolean;
  workoutsInBestWeek: number;
  distinctExercises: number;
}

export interface AchievementDef {
  key: string;
  title: string;
  rule: string;
  icon: string; // Ionicons-style name resolved in the UI layer
  met: (s: AchievementStats) => boolean;
  /** Progress toward the rule, as [current, target], when the rule is a threshold. */
  progress?: (s: AchievementStats) => [number, number];
}

const threshold = (key: string, title: string, rule: string, icon: string, pick: (s: AchievementStats) => number, target: number): AchievementDef => ({
  key, title, rule, icon, met: (s) => pick(s) >= target, progress: (s) => [Math.min(pick(s), target), target],
});

export const ACHIEVEMENTS: AchievementDef[] = [
  threshold('first_workout', 'First rep', 'Complete 1 workout', 'barbell', (s) => s.workouts, 1),
  threshold('workouts_10', 'Getting into it', 'Complete 10 workouts', 'flame', (s) => s.workouts, 10),
  threshold('workouts_50', 'Regular', 'Complete 50 workouts', 'medal', (s) => s.workouts, 50),
  threshold('workouts_100', 'Centurion', 'Complete 100 workouts', 'trophy', (s) => s.workouts, 100),
  threshold('first_run', 'Out the door', 'Log 1 run or walk', 'walk', (s) => s.runs, 1),
  threshold('distance_42', 'Marathon distance', 'Cover a total of 42.2 km on runs and walks', 'navigate', (s) => s.runDistanceM, 42_195),
  threshold('distance_100', '100 km club', 'Cover a total of 100 km on runs and walks', 'earth', (s) => s.runDistanceM, 100_000),
  { key: 'first_5k', title: 'First 5K', rule: 'Log one run of at least 5 km', icon: 'ribbon', met: (s) => s.longestRunM >= 5000, progress: (s) => [Math.min(s.longestRunM, 5000), 5000] },
  threshold('long_run_10k', '10K run', 'Log one run of at least 10 km', 'speedometer', (s) => s.longestRunM, 10_000),
  threshold('streak_3', 'Three in a row', 'Log activity on 3 consecutive days', 'calendar', (s) => s.longestStreakDays, 3),
  threshold('streak_7', 'Full week', 'Log activity on 7 consecutive days', 'calendar-number', (s) => s.longestStreakDays, 7),
  threshold('streak_30', 'Unbroken month', 'Log activity on 30 consecutive days', 'infinite', (s) => s.longestStreakDays, 30),
  threshold('volume_10t', 'Ten tonnes', 'Lift a total of 10,000 kg', 'fitness', (s) => s.totalVolumeKg, 10_000),
  threshold('volume_100t', 'Hundred tonnes', 'Lift a total of 100,000 kg', 'construct', (s) => s.totalVolumeKg, 100_000),
  threshold('first_pr', 'Personal best', 'Set 1 lifting personal record', 'star', (s) => s.prCount, 1),
  threshold('prs_10', 'Record breaker', 'Hold 10 personal records', 'sparkles', (s) => s.prCount, 10),
  threshold('variety_20', 'Well rounded', 'Use 20 different exercises in completed workouts', 'apps', (s) => s.distinctExercises, 20),
  threshold('cardio_5', 'Cardio regular', 'Log 5 cardio sessions', 'heart', (s) => s.cardioSessions, 5),
  threshold('tracker_10', 'Measured', 'Record 10 body measurements', 'body', (s) => s.measurements, 10),
  { key: 'weight_goal', title: 'Goal weight', rule: 'Reach the target weight of an active or completed weight goal', icon: 'flag', met: (s) => s.weightGoalReached },
  threshold('week_4', 'Four-workout week', 'Complete 4 workouts in one week', 'today', (s) => s.workoutsInBestWeek, 4),
];
