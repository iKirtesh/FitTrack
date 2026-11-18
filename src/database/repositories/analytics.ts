import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  bodyMeasurements, cardioSessions, dailyActivity, exercises, runningSessions, runningSplits, workoutExercises, workoutSessions, workoutSets,
} from '../schema';
import { longestStreak } from './records';
import { estimateOneRepMax } from '@/services/calculations';
import { addDays, dayRange, localDay, startOfWeek } from '@/utils/dates';
import type { AppDb } from '@/types/db';

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: '90d', label: '90D' },
  { key: '6m', label: '6M' }, { key: '1y', label: '1Y' }, { key: 'all', label: 'All' },
];

/** Inclusive [from, to] for a range ending today. `all` has no lower bound (null). */
export function rangeBounds(range: RangeKey, today: string = localDay()): { from: string | null; to: string } {
  const days: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 6, '30d': 29, '90d': 89, '6m': 182, '1y': 364 };
  return { from: range === 'all' ? null : addDays(today, -days[range]), to: today };
}

export const monthKey = (d: string) => d.slice(0, 7);

export function analyticsRepo(db: AppDb) {
  const completedWorkouts = (from: string | null, to: string) =>
    db.select().from(workoutSessions)
      .where(and(eq(workoutSessions.status, 'completed'), from ? gte(workoutSessions.date, from) : undefined, lte(workoutSessions.date, to)))
      .orderBy(asc(workoutSessions.startedAt)).all();

  const runsIn = (from: string | null, to: string) =>
    db.select().from(runningSessions)
      .where(and(eq(runningSessions.status, 'completed'), from ? gte(runningSessions.date, from) : undefined, lte(runningSessions.date, to)))
      .orderBy(asc(runningSessions.startedAt)).all();

  const bucket = <T>(items: T[], keyOf: (t: T) => string, valueOf: (t: T) => number) => {
    const m = new Map<string, number>();
    for (const i of items) m.set(keyOf(i), (m.get(keyOf(i)) ?? 0) + valueOf(i));
    return m;
  };

  return {
    /** Activity streak (any completed workout, run or cardio day) and this week's workout count. */
    streaks(today: string = localDay()) {
      const ws = db.select({ d: workoutSessions.date }).from(workoutSessions).where(eq(workoutSessions.status, 'completed')).all().map((x) => x.d);
      const runs = db.select({ d: runningSessions.date }).from(runningSessions).where(eq(runningSessions.status, 'completed')).all().map((x) => x.d);
      const cardio = db.select({ d: cardioSessions.date }).from(cardioSessions).all().map((x) => x.d);
      const days = new Set([...ws, ...runs, ...cardio]);
      // A streak is still alive if you have not yet trained today but did yesterday.
      let cur = 0;
      let d = days.has(today) ? today : addDays(today, -1);
      while (days.has(d)) { cur++; d = addDays(d, -1); }
      const monday = startOfWeek(today);
      const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      return {
        current: cur,
        best: longestStreak([...days]).length,
        weekDays: week.map((x) => ({ date: x, active: days.has(x), future: x > today })),
        weekWorkouts: ws.filter((x) => x >= monday && x <= today).length,
      };
    },

    /** Completed working sets per muscle group on one day (secondary muscles count half). Includes a workout still in progress. */
    muscleLoadForDay(day: string = localDay()): Record<string, number> {
      const rows = db.select({ group: exercises.muscleGroupId, secondary: exercises.secondaryMuscles }).from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
        .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
        .where(and(eq(workoutSets.isCompleted, true), sql`${workoutSets.kind} != 'warmup'`, eq(workoutSessions.date, day), sql`${workoutSessions.status} != 'discarded'`)).all();
      const load: Record<string, number> = {};
      for (const r of rows) {
        load[r.group] = (load[r.group] ?? 0) + 1;
        let sec: string[] = [];
        try { sec = JSON.parse(r.secondary) as string[]; } catch { /* ignore malformed */ }
        for (const s of sec) load[s] = (load[s] ?? 0) + 0.5;
      }
      return load;
    },

    workoutStats(range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      const ws = completedWorkouts(from, to);
      const byWeek = bucket(ws, (w) => startOfWeek(w.date), () => 1);
      const byMonth = bucket(ws, (w) => monthKey(w.date), () => 1);
      const muscle = db.select({ group: exercises.muscleGroupId, n: sql<number>`count(*)` }).from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
        .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
        .where(and(eq(workoutSets.isCompleted, true), eq(workoutSessions.status, 'completed'), from ? gte(workoutSessions.date, from) : undefined, lte(workoutSessions.date, to)))
        .groupBy(exercises.muscleGroupId).all();
      const totalSets = muscle.reduce((a, m) => a + m.n, 0);
      const weeks = from ? Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / (7 * 86_400_000))) : Math.max(1, byWeek.size);
      return {
        totalWorkouts: ws.length,
        totalSeconds: ws.reduce((a, w) => a + (w.durationSec ?? 0), 0),
        totalVolumeKg: ws.reduce((a, w) => a + w.totalVolumeKg, 0),
        avgPerWeek: ws.length / weeks,
        weekly: [...byWeek].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
        monthly: [...byMonth].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
        volumeSeries: ws.map((w) => ({ date: w.date, value: w.totalVolumeKg })),
        muscleDistribution: muscle.map((m) => ({ groupId: m.group, sets: m.n, share: totalSets ? m.n / totalSets : 0 })).sort((a, b) => b.sets - a.sets),
      };
    },

    /** Per-session top weight, estimated 1RM and volume for one exercise: the strength progression chart. */
    exerciseProgression(exerciseId: string, range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      const rows = db.select({ date: workoutSessions.date, startedAt: workoutSessions.startedAt, weightKg: workoutSets.weightKg, reps: workoutSets.reps })
        .from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
        .where(and(eq(workoutExercises.exerciseId, exerciseId), eq(workoutSets.isCompleted, true), sql`${workoutSets.kind} != 'warmup'`, eq(workoutSessions.status, 'completed'), from ? gte(workoutSessions.date, from) : undefined, lte(workoutSessions.date, to)))
        .orderBy(asc(workoutSessions.startedAt)).all();
      const per = new Map<string, { date: string; topWeightKg: number; est1rmKg: number | null; volumeKg: number; bestReps: number }>();
      for (const r of rows) {
        const k = `${r.startedAt}`;
        const cur = per.get(k) ?? { date: r.date, topWeightKg: 0, est1rmKg: null, volumeKg: 0, bestReps: 0 };
        cur.topWeightKg = Math.max(cur.topWeightKg, r.weightKg ?? 0);
        const e = r.weightKg && r.reps ? estimateOneRepMax(r.weightKg, r.reps) : null;
        if (e != null) cur.est1rmKg = Math.max(cur.est1rmKg ?? 0, e);
        cur.volumeKg += (r.weightKg ?? 0) * (r.reps ?? 0);
        cur.bestReps = Math.max(cur.bestReps, r.reps ?? 0);
        per.set(k, cur);
      }
      return [...per.values()];
    },

    runningStats(range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      const rs = runsIn(from, to);
      const runsOnly = rs.filter((r) => ['outdoor_run', 'indoor_run', 'treadmill'].includes(r.activityType));
      const totalDistanceM = rs.reduce((a, r) => a + r.distanceM, 0);
      const runDistanceM = runsOnly.reduce((a, r) => a + r.distanceM, 0);
      const runTimeSec = runsOnly.reduce((a, r) => a + (r.movingTimeSec ?? r.durationSec), 0);
      const longest = runsOnly.reduce<(typeof rs)[number] | null>((b, r) => (!b || r.distanceM > b.distanceM ? r : b), null);
      const fastestKm = db.select({ pace: sql<number | null>`min(${runningSplits.paceSecPerKm})` }).from(runningSplits)
        .innerJoin(runningSessions, eq(runningSplits.sessionId, runningSessions.id))
        .where(and(sql`abs(${runningSplits.distanceM} - 1000) < 1`, eq(runningSessions.status, 'completed'), from ? gte(runningSessions.date, from) : undefined, lte(runningSessions.date, to))).get()?.pace ?? null;
      const weekly = bucket(rs, (r) => startOfWeek(r.date), (r) => r.distanceM);
      const monthly = bucket(rs, (r) => monthKey(r.date), (r) => r.distanceM);
      return {
        count: rs.length, totalDistanceM, runDistanceM,
        totalSeconds: rs.reduce((a, r) => a + r.durationSec, 0),
        avgPaceSecPerKm: runDistanceM > 0 ? runTimeSec / (runDistanceM / 1000) : null,
        longestRunM: longest?.distanceM ?? null, fastestKmSecPerKm: fastestKm,
        weekly: [...weekly].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
        monthly: [...monthly].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
        paceSeries: runsOnly.filter((r) => r.avgPaceSecPerKm != null).map((r) => ({ date: r.date, value: r.avgPaceSecPerKm as number })),
      };
    },

    weightSeries(range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      return db.select({ date: bodyMeasurements.date, value: bodyMeasurements.weightKg }).from(bodyMeasurements)
        .where(and(sql`${bodyMeasurements.weightKg} IS NOT NULL`, from ? gte(bodyMeasurements.date, from) : undefined, lte(bodyMeasurements.date, to)))
        .orderBy(asc(bodyMeasurements.date), asc(bodyMeasurements.createdAt)).all() as { date: string; value: number }[];
    },

    /** Change in weight over the last 7 / 30 days relative to the most recent reading on or before the window start. */
    weightChange() {
      const all = db.select({ date: bodyMeasurements.date, w: bodyMeasurements.weightKg }).from(bodyMeasurements)
        .where(sql`${bodyMeasurements.weightKg} IS NOT NULL`).orderBy(asc(bodyMeasurements.date), asc(bodyMeasurements.createdAt)).all() as { date: string; w: number }[];
      const latest = all[all.length - 1];
      if (!latest) return { weekly: null, monthly: null, latest: null };
      const baseline = (days: number) => {
        const cut = addDays(latest.date, -days);
        const before = [...all].reverse().find((r) => r.date <= cut);
        return before ? latest.w - before.w : null;
      };
      return { weekly: baseline(7), monthly: baseline(30), latest: latest.w };
    },

    /** Any circumference/body-fat column over time. Only whitelisted columns are accepted. */
    measurementSeries(field: 'bodyFatPct' | 'chestCm' | 'waistCm' | 'hipsCm' | 'armsCm' | 'forearmsCm' | 'thighsCm' | 'calvesCm' | 'neckCm', range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      const col = bodyMeasurements[field];
      return db.select({ date: bodyMeasurements.date, value: col }).from(bodyMeasurements)
        .where(and(sql`${col} IS NOT NULL`, from ? gte(bodyMeasurements.date, from) : undefined, lte(bodyMeasurements.date, to)))
        .orderBy(asc(bodyMeasurements.date)).all() as { date: string; value: number }[];
    },

    /** Workout days per week as a fraction of the user's preferred days (or 3 if unspecified). */
    consistency(range: RangeKey, preferredPerWeek = 3, today: string = localDay()) {
      const { from, to } = rangeBounds(range, today);
      const start = from ?? to;
      const weekStarts = [...new Set(dayRange(startOfWeek(start), to).map(startOfWeek))];
      const days = new Set([...completedWorkouts(from, to).map((w) => w.date), ...runsIn(from, to).map((r) => r.date)]);
      const weeks = weekStarts.map((ws) => {
        const n = dayRange(ws, addDays(ws, 6)).filter((d) => days.has(d)).length;
        return { date: ws, activeDays: n, met: n >= preferredPerWeek };
      });
      return { weeks, weeksMet: weeks.filter((w) => w.met).length, totalWeeks: weeks.length };
    },

    dailyActivityTrend(range: RangeKey, today: string = localDay()) {
      const { from, to } = rangeBounds(range === 'all' ? '1y' : range, today);
      return db.select().from(dailyActivity).where(and(from ? gte(dailyActivity.date, from) : undefined, lte(dailyActivity.date, to))).orderBy(asc(dailyActivity.date)).all();
    },

    /** Last 7 days (ending today) of workout minutes, run km and cardio-agnostic activity for the dashboard chart. */
    weekActivity(today: string = localDay()) {
      const from = addDays(today, -6);
      const ws = completedWorkouts(from, today);
      const rs = runsIn(from, today);
      return dayRange(from, today).map((date) => ({
        date,
        workoutMinutes: Math.round(ws.filter((w) => w.date === date).reduce((a, w) => a + (w.durationSec ?? 0), 0) / 60),
        distanceM: rs.filter((r) => r.date === date).reduce((a, r) => a + r.distanceM, 0),
      }));
    },
  };
}
