import { Platform } from 'react-native';
import { addDays, localDay } from '@/utils/dates';

/**
 * Read-only import from Android Health Connect (where Google Fit, Fitbit, Samsung Health etc. sync).
 * Returns plain data; the caller decides what to save. Android only; never runs on web or iOS.
 * NOT yet verified on a physical device.
 */
export type HealthImport = { steps: { date: string; steps: number }[]; weights: { date: string; weightKg: number }[] };
export type HealthResult = { ok: true; data: HealthImport } | { ok: false; reason: string };

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

export async function importFromHealthConnect(days = 30): Promise<HealthResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'Health Connect is only available on Android.' };
  try {
    // Required lazily so web, iOS and tests never load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hc = require('react-native-health-connect') as typeof import('react-native-health-connect');
    const status = await hc.getSdkStatus();
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: false, reason: 'Health Connect is not installed or needs an update. Install or update it from Google Play, then try again.' };
    if (!(await hc.initialize())) return { ok: false, reason: 'Health Connect could not be started.' };
    const granted = await hc.requestPermission([...PERMISSIONS]);
    const has = (t: string) => granted.some((p) => p.recordType === t && p.accessType === 'read');
    if (!has('Steps') && !has('Weight')) return { ok: false, reason: 'No Health Connect permission was granted, so nothing was imported.' };

    const today = localDay();
    const from = addDays(today, -(days - 1));
    const start = new Date(`${from}T00:00:00`);
    const end = new Date();
    const timeRangeFilter = { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };

    const steps: HealthImport['steps'] = [];
    if (has('Steps')) {
      // Aggregation lets Health Connect de-duplicate overlapping sources instead of us double counting.
      const groups = await hc.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: `${from}T00:00:00`, endTime: end.toISOString().slice(0, 19) }, timeRangeSlicer: { period: 'DAYS', length: 1 } });
      for (const g of groups) {
        const n = Math.round(g.result.COUNT_TOTAL ?? 0);
        if (n > 0) steps.push({ date: g.startTime.slice(0, 10), steps: n });
      }
    }
    const weights: HealthImport['weights'] = [];
    if (has('Weight')) {
      const { records } = await hc.readRecords('Weight', { timeRangeFilter });
      for (const r of records) {
        const kg = r.weight.inKilograms;
        if (kg && kg > 0 && kg < 500) weights.push({ date: localDay(new Date(r.time).getTime()), weightKg: Math.round(kg * 10) / 10 });
      }
    }
    return { ok: true, data: { steps, weights } };
  } catch (e) {
    return { ok: false, reason: `Health Connect import failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
