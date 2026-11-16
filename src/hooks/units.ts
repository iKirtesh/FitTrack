import { useProfile } from './data';
import { formatDistance, formatPace, formatWeight } from '@/utils/units';
import type { DistanceUnit, WeightUnit } from '@/constants/profile';

/** Display units from the profile. Storage stays kg/m; these only format for the screen. */
export function useUnits() {
  const { data } = useProfile();
  const wu: WeightUnit = data?.weightUnit === 'lb' ? 'lb' : 'kg';
  const du: DistanceUnit = data?.distanceUnit === 'mi' ? 'mi' : 'km';
  return { wu, du, weight: (kg: number | null | undefined, dp = 1) => formatWeight(kg, wu, dp), distance: (m: number | null | undefined, dp = 2) => formatDistance(m, du, dp), pace: (s: number | null | undefined) => formatPace(s, du) };
}
