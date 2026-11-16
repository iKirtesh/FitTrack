import { formatDuration } from '@/utils/units';
import type { useUnits } from '@/hooks/units';

const NAMES: Record<string, string> = {
  max_weight: 'Heaviest', est_1rm: 'Est. 1RM', max_reps: 'Most reps', max_duration: 'Longest hold',
  longest_run: 'Longest run', fastest_5k: 'Fastest 5K', longest_workout: 'Longest workout',
  best_week_distance: 'Best week distance', best_streak: 'Longest streak',
};

export const recordLabel = (kind: string, subject: string | null) => (subject ? `${subject}: ${NAMES[kind] ?? kind}` : NAMES[kind] ?? kind);

export function recordValue(r: { kind: string; value: number; unit: string }, u: ReturnType<typeof useUnits>): string {
  switch (r.unit) {
    case 'kg': return u.weight(r.value);
    case 'm': return u.distance(r.value);
    case 'sec': return formatDuration(r.value);
    case 'reps': return `${r.value} reps`;
    case 'days': return `${r.value} days`;
    default: return `${r.value} ${r.unit}`;
  }
}
