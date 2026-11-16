import type { TrackingType } from '@/constants/exercise';
import { INTENSITY_FACTOR, type Intensity } from '@/constants/activities';

export interface SetLike {
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  isCompleted?: boolean;
  kind?: string;
}

/** Warm-up sets are excluded from volume so a heavy day isn't inflated by empty-bar sets. */
export function setVolumeKg(s: SetLike, trackingType: TrackingType, bodyweightKg?: number | null): number {
  if (s.isCompleted === false || s.kind === 'warmup') return 0;
  const reps = s.reps ?? 0;
  switch (trackingType) {
    case 'weight_reps':
      return (s.weightKg ?? 0) * reps;
    case 'assisted': {
      // Assistance reduces the load: effective = bodyweight - assistance. Needs a known bodyweight.
      if (bodyweightKg == null) return 0;
      return Math.max(0, bodyweightKg - (s.weightKg ?? 0)) * reps;
    }
    default:
      return 0;
  }
}

export function totalVolumeKg(
  sets: SetLike[],
  trackingType: TrackingType,
  bodyweightKg?: number | null,
): number {
  return sets.reduce((sum, s) => sum + setVolumeKg(s, trackingType, bodyweightKg), 0);
}

/** Epley estimated one-rep max. Labelled "estimated" in the UI. Only meaningful up to ~12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;
  if (reps > 12) return null;
  return weightKg * (1 + reps / 30);
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(v: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (v < 18.5) return 'underweight';
  if (v < 25) return 'normal';
  if (v < 30) return 'overweight';
  return 'obese';
}

/** kcal = MET x kg x hours. An estimate, not a measurement. */
export function caloriesFromMet(
  met: number,
  weightKg: number,
  durationSec: number,
  intensity: Intensity = 'moderate',
): number {
  if (weightKg <= 0 || durationSec <= 0) return 0;
  return Math.round(met * INTENSITY_FACTOR[intensity] * weightKg * (durationSec / 3600));
}

/** Mifflin-St Jeor resting energy. Gender-neutral midpoint is used when gender is unknown. */
export function bmr(opts: { weightKg: number; heightCm: number; age: number; gender?: string | null }): number {
  const base = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age;
  if (opts.gender === 'male') return base + 5;
  if (opts.gender === 'female') return base - 161;
  return base - 78;
}

/** Progress 0..1 toward a target from a start value; works for both loss and gain goals. */
export function goalProgress(start: number, current: number, target: number): number {
  if (start === target) return current === target ? 1 : 0;
  const p = (current - start) / (target - start);
  return Math.min(1, Math.max(0, p));
}
