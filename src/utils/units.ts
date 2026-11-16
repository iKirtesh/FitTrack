import type { DistanceUnit, WeightUnit } from '@/constants/profile';

const KG_PER_LB = 0.45359237;
const M_PER_MI = 1609.344;

/** Storage is always kg / metres / cm / seconds. Conversion happens only at the UI edge. */
export const kgToDisplay = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const displayToKg = (v: number, unit: WeightUnit) => (unit === 'kg' ? v : v * KG_PER_LB);
export const mToDisplay = (m: number, unit: DistanceUnit) => (unit === 'km' ? m / 1000 : m / M_PER_MI);
export const displayToM = (v: number, unit: DistanceUnit) => (unit === 'km' ? v * 1000 : v * M_PER_MI);
export const cmToFeetInches = (cm: number) => {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round(totalIn - ft * 12) };
};

export const round = (v: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, dp = 1): string {
  if (kg == null) return '-';
  return `${round(kgToDisplay(kg, unit), dp)} ${unit}`;
}

export function formatDistance(m: number | null | undefined, unit: DistanceUnit, dp = 2): string {
  if (m == null) return '-';
  return `${round(mToDisplay(m, unit), dp)} ${unit}`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '-';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const rr = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${rr}` : `${m}:${rr}`;
}

/** Pace is stored as seconds per km; shown per km or per mile. */
export function formatPace(secPerKm: number | null | undefined, unit: DistanceUnit): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '-';
  const perUnit = unit === 'km' ? secPerKm : secPerKm * (M_PER_MI / 1000);
  const m = Math.floor(perUnit / 60);
  const s = Math.round(perUnit % 60);
  const carry = s === 60;
  return `${carry ? m + 1 : m}:${String(carry ? 0 : s).padStart(2, '0')} /${unit}`;
}
