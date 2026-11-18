import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRepos } from '@/hooks/data';
import type { Repos } from '@/hooks/data';
import { importFromHealthConnect, type HealthImport } from '@/services/healthconnect';
import { addDays, localDay } from '@/utils/dates';

export const AUTO_KEY = 'healthconnect.auto';
const LAST_KEY = 'healthconnect.lastSync';
const MIN_GAP_MS = 15 * 60 * 1000;

/** Saves imported data without ever lowering a steps value or duplicating a day's weight. */
export function applyHealthImport(r: Repos, data: HealthImport): { steps: number; weights: number } {
  let steps = 0, weights = 0;
  for (const d of data.steps) {
    if (d.steps > r.daily.get(d.date).steps) { r.daily.setSteps(d.date, d.steps, 'health_connect'); steps++; }
  }
  const have = new Set(r.measurements.list({ from: addDays(localDay(), -30) }).filter((m) => m.weightKg != null).map((m) => m.date));
  for (const w of data.weights) {
    if (!have.has(w.date)) { r.measurements.create({ date: w.date, weightKg: w.weightKg, notes: 'Imported from Health Connect' }); have.add(w.date); weights++; }
  }
  return { steps, weights };
}

/** When enabled in Settings: imports on app start and whenever the app returns to the foreground (at most every 15 min). Not a background service. */
export function useAutoHealthSync() {
  const repos = useRepos();
  const qc = useQueryClient();
  const busy = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const run = async () => {
      if (busy.current || !repos.settings.get<boolean>(AUTO_KEY, false)) return;
      if (Date.now() - repos.settings.get<number>(LAST_KEY, 0) < MIN_GAP_MS) return;
      busy.current = true;
      try {
        const res = await importFromHealthConnect(7, false);
        if (res.ok) {
          applyHealthImport(repos, res.data);
          repos.settings.set(LAST_KEY, Date.now());
          await qc.invalidateQueries();
        }
      } finally { busy.current = false; }
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void run(); });
    return () => sub.remove();
  }, [repos, qc]);
}
