/** Preset plan layouts. Exercises are referenced by seed key; days are 0=Sun..6=Sat. */
export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  days: { dayOfWeek: number; name: string; exercises: { key: string; sets: number; reps: number; rest?: number }[] }[];
}

const e = (key: string, sets = 3, reps = 10, rest = 90) => ({ key, sets, reps, rest });

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'ppl', name: 'Push Pull Legs', description: 'Six days: push, pull and legs, twice a week.',
    days: [
      { dayOfWeek: 1, name: 'Push A', exercises: [e('barbell_bench_press', 4, 6, 150), e('overhead_press', 3, 8), e('incline_dumbbell_press', 3, 10), e('lateral_raise', 3, 15, 60), e('triceps_pushdown', 3, 12, 60)] },
      { dayOfWeek: 2, name: 'Pull A', exercises: [e('deadlift', 3, 5, 180), e('pull_up', 3, 8), e('barbell_row', 3, 8), e('face_pull', 3, 15, 60), e('barbell_curl', 3, 10, 60)] },
      { dayOfWeek: 3, name: 'Legs A', exercises: [e('barbell_back_squat', 4, 6, 180), e('romanian_deadlift', 3, 8), e('leg_press', 3, 12), e('lying_leg_curl', 3, 12, 60), e('standing_calf_raise', 4, 12, 60)] },
      { dayOfWeek: 4, name: 'Push B', exercises: [e('incline_barbell_bench_press', 4, 8), e('seated_dumbbell_press', 3, 10), e('pec_deck', 3, 12, 60), e('cable_lateral_raise', 3, 15, 60), e('overhead_triceps_extension', 3, 12, 60)] },
      { dayOfWeek: 5, name: 'Pull B', exercises: [e('lat_pulldown', 4, 10), e('seated_cable_row', 3, 10), e('one_arm_dumbbell_row', 3, 10), e('rear_delt_fly', 3, 15, 60), e('hammer_curl', 3, 12, 60)] },
      { dayOfWeek: 6, name: 'Legs B', exercises: [e('front_squat', 3, 6, 150), e('hip_thrust', 3, 10), e('bulgarian_split_squat', 3, 10), e('seated_leg_curl', 3, 12, 60), e('seated_calf_raise', 4, 15, 60)] },
    ],
  },
  {
    id: 'upper_lower', name: 'Upper / Lower', description: 'Four days alternating upper and lower body.',
    days: [
      { dayOfWeek: 1, name: 'Upper A', exercises: [e('barbell_bench_press', 4, 6, 150), e('barbell_row', 4, 8), e('overhead_press', 3, 8), e('lat_pulldown', 3, 10), e('dumbbell_curl', 2, 12, 60), e('triceps_pushdown', 2, 12, 60)] },
      { dayOfWeek: 2, name: 'Lower A', exercises: [e('barbell_back_squat', 4, 6, 180), e('romanian_deadlift', 3, 8), e('leg_press', 3, 12), e('lying_leg_curl', 3, 12, 60), e('standing_calf_raise', 4, 12, 60)] },
      { dayOfWeek: 4, name: 'Upper B', exercises: [e('incline_dumbbell_press', 4, 10), e('seated_cable_row', 4, 10), e('seated_dumbbell_press', 3, 10), e('pull_up', 3, 8), e('hammer_curl', 2, 12, 60), e('skull_crusher', 2, 12, 60)] },
      { dayOfWeek: 5, name: 'Lower B', exercises: [e('deadlift', 3, 5, 180), e('front_squat', 3, 8, 150), e('walking_lunge', 3, 12), e('leg_extension', 3, 12, 60), e('seated_calf_raise', 4, 15, 60)] },
    ],
  },
  {
    id: 'full_body', name: 'Full Body', description: 'Three full-body sessions a week.',
    days: [
      { dayOfWeek: 1, name: 'Full Body A', exercises: [e('barbell_back_squat', 3, 8, 150), e('barbell_bench_press', 3, 8, 120), e('barbell_row', 3, 8), e('plank', 3, 1, 60)] },
      { dayOfWeek: 3, name: 'Full Body B', exercises: [e('deadlift', 3, 5, 180), e('overhead_press', 3, 8), e('lat_pulldown', 3, 10), e('walking_lunge', 3, 10)] },
      { dayOfWeek: 5, name: 'Full Body C', exercises: [e('front_squat', 3, 8, 150), e('incline_dumbbell_press', 3, 10), e('seated_cable_row', 3, 10), e('hip_thrust', 3, 10)] },
    ],
  },
  {
    id: 'bro_split', name: 'Bro Split', description: 'Five days, one muscle group focus per day.',
    days: [
      { dayOfWeek: 1, name: 'Chest', exercises: [e('barbell_bench_press', 4, 8, 120), e('incline_dumbbell_press', 3, 10), e('dumbbell_fly', 3, 12, 60), e('cable_crossover', 3, 12, 60)] },
      { dayOfWeek: 2, name: 'Back', exercises: [e('deadlift', 3, 5, 180), e('pull_up', 3, 8), e('barbell_row', 3, 8), e('seated_cable_row', 3, 10)] },
      { dayOfWeek: 3, name: 'Shoulders', exercises: [e('overhead_press', 4, 8, 120), e('lateral_raise', 4, 15, 60), e('rear_delt_fly', 3, 15, 60), e('dumbbell_shrug', 3, 12, 60)] },
      { dayOfWeek: 4, name: 'Arms', exercises: [e('barbell_curl', 4, 10, 60), e('skull_crusher', 4, 10, 60), e('hammer_curl', 3, 12, 60), e('triceps_pushdown', 3, 12, 60)] },
      { dayOfWeek: 5, name: 'Legs', exercises: [e('barbell_back_squat', 4, 8, 180), e('leg_press', 3, 12), e('lying_leg_curl', 3, 12, 60), e('standing_calf_raise', 4, 15, 60)] },
    ],
  },
  {
    id: 'beginner', name: 'Beginner Workout', description: 'Three simple machine and dumbbell sessions to build the habit.',
    days: [
      { dayOfWeek: 1, name: 'Day 1', exercises: [e('goblet_squat', 3, 10), e('dumbbell_bench_press', 3, 10), e('seated_cable_row', 3, 10), e('plank', 3, 1, 60)] },
      { dayOfWeek: 3, name: 'Day 2', exercises: [e('leg_press', 3, 12), e('machine_shoulder_press', 3, 10), e('lat_pulldown', 3, 10), e('crunch', 3, 12, 60)] },
      { dayOfWeek: 5, name: 'Day 3', exercises: [e('romanian_deadlift', 3, 10), e('push_up', 3, 8), e('one_arm_dumbbell_row', 3, 10), e('glute_bridge', 3, 12, 60)] },
    ],
  },
];
