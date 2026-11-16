import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  exercises, personalRecords, runningSessions, runningSplits, workoutExercises, workoutSessions, workoutSets,
  cardioSessions,
} from '../schema';
import { estimateOneRepMax } from '@/services/calculations';
import { startOfWeek, daysBetween } from '@/utils/dates';
import { newId } from '@/utils/id';
import type { AppDb } from '@/types/db';

export type RecordKind =
  | 'max_weight' | 'est_1rm' | 'max_reps' | 'max_duration'
  | 'longest_run' | 'fastest_5k' | 'longest_workout' | 'best_week_distance' | 'best_streak';

export interface RecordCandidate {
  kind: RecordKind;
  subjectId: string | null;
  value: number;
  unit: string;
  sourceType: 'workout_session' | 'running_session' | 'derived';
  sourceId: string | null;
  achievedAt: number;
  date: string;
}

export interface RecordChange {
  kind: RecordKind;
  subjectId: string | null;
  subjectName: string | null;
  previous: number | null;
  value: number;
  unit: string;
}

const RUN_KINDS = ['outdoor_run', 'indoor_run', 'treadmill'];

const key = (k: string, s: string | null) => `${k}::${s ?? ''}`;

/** Best total time over any 5 consecutive full-km splits. Needs real splits; never extrapolated. */
export function bestFiveKFromSplits(splits: { splitIndex: number; distanceM: number; durationSec: number }[]): number | null {
  const full = splits.filter((s) => Math.abs(s.distanceM - 1000) < 1).sort((a, b) => a.splitIndex - b.splitIndex);
  if (full.length < 5) return null;
  let best: number | null = null;
  for (let i = 0; i + 4 < full.length; i++) {
    const window = full.slice(i, i + 5);
    // Consecutive by index only; a gap means a missing split.
    if (window[4]!.splitIndex - window[0]!.splitIndex !== 4) continue;
    const t = window.reduce((a, s) => a + s.durationSec, 0);
    if (best == null || t < best) best = t;
  }
  return best;
}

/** Longest run of consecutive days present in `days` (YYYY-MM-DD, any order, duplicates allowed). */
export function longestStreak(days: string[]): { length: number; endDay: string | null } {
  const uniq = [...new Set(days)].sort();
  let best = 0, run = 0, bestEnd: string | null = null;
  for (let i = 0; i < uniq.length; i++) {
    run = i > 0 && daysBetween(uniq[i - 1]!, uniq[i]!) === 1 ? run + 1 : 1;
    if (run > best) { best = run; bestEnd = uniq[i]!; }
  }
  return { length: best, endDay: bestEnd };
}

/** Pure derivation of every record from recorded data. Nothing here is estimated except `est_1rm`, which is labelled. */
export function computeCandidates(db: AppDb): RecordCandidate[] {
  const out: RecordCandidate[] = [];

  // ---- Lifting records, from completed, non-warm-up sets of completed workouts.
  const rows = db
    .select({
      exerciseId: workoutExercises.exerciseId,
      tracking: exercises.trackingType,
      weightKg: workoutSets.weightKg,
      reps: workoutSets.reps,
      durationSec: workoutSets.durationSec,
      completedAt: workoutSets.completedAt,
      sessionId: workoutSessions.id,
      date: workoutSessions.date,
      startedAt: workoutSessions.startedAt,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(and(eq(workoutSets.isCompleted, true), eq(workoutSessions.status, 'completed'), sql`${workoutSets.kind} != 'warmup'`))
    .orderBy(asc(workoutSessions.startedAt))
    .all();

  const best = new Map<string, RecordCandidate>();
  const consider = (c: RecordCandidate) => {
    const k = key(c.kind, c.subjectId);
    const cur = best.get(k);
    // Strictly greater: on ties the earliest achievement keeps the record.
    if (!cur || c.value > cur.value) best.set(k, c);
  };
  for (const r of rows) {
    const base = {
      subjectId: r.exerciseId,
      sourceType: 'workout_session' as const,
      sourceId: r.sessionId,
      achievedAt: r.completedAt ?? r.startedAt,
      date: r.date,
    };
    if (r.tracking === 'weight_reps' && r.weightKg && r.reps && r.weightKg > 0 && r.reps > 0) {
      consider({ ...base, kind: 'max_weight', value: r.weightKg, unit: 'kg' });
      const e = estimateOneRepMax(r.weightKg, r.reps);
      if (e) consider({ ...base, kind: 'est_1rm', value: e, unit: 'kg' });
    } else if (r.tracking === 'bodyweight_reps' && r.reps && r.reps > 0) {
      consider({ ...base, kind: 'max_reps', value: r.reps, unit: 'reps' });
    } else if ((r.tracking === 'timed' || r.tracking === 'duration') && r.durationSec && r.durationSec > 0) {
      consider({ ...base, kind: 'max_duration', value: r.durationSec, unit: 'sec' });
    }
  }
  out.push(...best.values());

  // ---- Longest workout.
  const lw = db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'completed'), sql`${workoutSessions.durationSec} IS NOT NULL`))
    .orderBy(desc(workoutSessions.durationSec), asc(workoutSessions.startedAt))
    .limit(1)
    .get();
  if (lw?.durationSec) {
    out.push({ kind: 'longest_workout', subjectId: null, value: lw.durationSec, unit: 'sec', sourceType: 'workout_session', sourceId: lw.id, achievedAt: lw.endedAt ?? lw.startedAt, date: lw.date });
  }

  // ---- Running records.
  const runs = db
    .select()
    .from(runningSessions)
    .where(and(eq(runningSessions.status, 'completed'), inArray(runningSessions.activityType, RUN_KINDS)))
    .orderBy(asc(runningSessions.startedAt))
    .all();
  let longest: (typeof runs)[number] | null = null;
  for (const r of runs) if (!longest || r.distanceM > longest.distanceM) longest = r;
  if (longest && longest.distanceM > 0) {
    out.push({ kind: 'longest_run', subjectId: null, value: longest.distanceM, unit: 'm', sourceType: 'running_session', sourceId: longest.id, achievedAt: longest.endedAt ?? longest.startedAt, date: longest.date });
  }

  let fastest: { t: number; run: (typeof runs)[number] } | null = null;
  for (const r of runs) {
    let t: number | null = null;
    const splits = db.select().from(runningSplits).where(eq(runningSplits.sessionId, r.id)).all();
    if (splits.length) t = bestFiveKFromSplits(splits);
    // A manual entry of almost exactly 5 km (+/- 1%) is accepted at face value; anything else is not guessed.
    else if (r.source === 'manual' && r.distanceM >= 4950 && r.distanceM <= 5050 && r.durationSec > 0) t = r.durationSec;
    if (t != null && (!fastest || t < fastest.t)) fastest = { t, run: r };
  }
  if (fastest) {
    // Stored in seconds; lower is better for this kind (handled in rebuild()).
    out.push({ kind: 'fastest_5k', subjectId: null, value: fastest.t, unit: 'sec', sourceType: 'running_session', sourceId: fastest.run.id, achievedAt: fastest.run.endedAt ?? fastest.run.startedAt, date: fastest.run.date });
  }

  // ---- Highest weekly distance (Monday-based weeks, runs and walks both count).
  const allRuns = db.select().from(runningSessions).where(eq(runningSessions.status, 'completed')).all();
  const weeks = new Map<string, number>();
  for (const r of allRuns) weeks.set(startOfWeek(r.date), (weeks.get(startOfWeek(r.date)) ?? 0) + r.distanceM);
  let bw: [string, number] | null = null;
  for (const e of weeks) if (!bw || e[1] > bw[1]) bw = e;
  if (bw && bw[1] > 0) {
    out.push({ kind: 'best_week_distance', subjectId: null, value: bw[1], unit: 'm', sourceType: 'derived', sourceId: null, achievedAt: Date.now(), date: bw[0] });
  }

  // ---- Longest activity streak (any completed workout, run or cardio session on a day).
  const days = [
    ...db.select({ d: workoutSessions.date }).from(workoutSessions).where(eq(workoutSessions.status, 'completed')).all().map((r) => r.d),
    ...allRuns.map((r) => r.date),
    ...db.select({ d: cardioSessions.date }).from(cardioSessions).all().map((r) => r.d),
  ];
  const st = longestStreak(days);
  if (st.length >= 2 && st.endDay) {
    out.push({ kind: 'best_streak', subjectId: null, value: st.length, unit: 'days', sourceType: 'derived', sourceId: null, achievedAt: Date.now(), date: st.endDay });
  }
  return out;
}

export function recordsRepo(db: AppDb) {
  const names = () => new Map(db.select({ id: exercises.id, name: exercises.name }).from(exercises).all().map((e) => [e.id, e.name]));

  return {
    list(): (typeof personalRecords.$inferSelect & { subjectName: string | null })[] {
      const n = names();
      return db.select().from(personalRecords).orderBy(desc(personalRecords.achievedAt)).all()
        .map((r) => ({ ...r, subjectName: r.subjectId ? n.get(r.subjectId) ?? null : null }));
    },

    recent(limit = 5) {
      return this.list().slice(0, limit);
    },

    /**
     * Re-derives every record from the recorded data and stores the result. Returns only records
     * that are new or improved, so the UI can celebrate genuine PRs. Records whose source data
     * was deleted disappear, so the list always matches what is actually stored.
     */
    rebuild(): RecordChange[] {
      const cands = computeCandidates(db);
      const n = names();
      const changes: RecordChange[] = [];
      db.transaction((tx) => {
        const prev = new Map(tx.select().from(personalRecords).all().map((r) => [key(r.kind, r.subjectId), r]));
        tx.delete(personalRecords).run();
        for (const c of cands) {
          const p = prev.get(key(c.kind, c.subjectId));
          // For fastest_5k lower is better, handled below; everything else higher is better.
          const improved = !p ? true : c.kind === 'fastest_5k' ? c.value < p.value : c.value > p.value;
          const keepAchieved = p && !improved ? p : null;
          tx.insert(personalRecords).values({
            id: keepAchieved?.id ?? newId(),
            kind: c.kind, subjectId: c.subjectId, value: c.value, unit: c.unit,
            sourceType: c.sourceType, sourceId: c.sourceId, achievedAt: c.achievedAt, date: c.date,
          }).run();
          if (improved && c.kind !== 'best_streak' && c.kind !== 'best_week_distance') {
            changes.push({ kind: c.kind, subjectId: c.subjectId, subjectName: c.subjectId ? n.get(c.subjectId) ?? null : null, previous: p?.value ?? null, value: c.value, unit: c.unit });
          }
        }
      });
      return changes;
    },

    forExercise(exerciseId: string) {
      return db.select().from(personalRecords).where(eq(personalRecords.subjectId, exerciseId)).all();
    },
  };
}

