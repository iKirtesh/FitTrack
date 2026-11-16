import { and, asc, desc, eq, gte, lte, sql, inArray, max, count } from 'drizzle-orm';
import {
  exercises, userProfiles, workoutExercises, workoutPlanExercises, workoutSessions, workoutSets,
} from '../schema';
import { STRENGTH_MET, type Intensity } from '@/constants/activities';
import type { TrackingType } from '@/constants/exercise';
import { caloriesFromMet, totalVolumeKg } from '@/services/calculations';
import { localDay } from '@/utils/dates';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import { recordsRepo, type RecordChange } from './records';
import type { AppDb, Tx } from '@/types/db';

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export interface WorkoutExerciseDetail {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroupId: string;
  trackingType: TrackingType;
  position: number;
  restSec: number;
  notes: string | null;
  sets: WorkoutSet[];
}
export interface WorkoutDetail extends WorkoutSession {
  exercises: WorkoutExerciseDetail[];
}
export interface SetPatch {
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  kind?: string;
}
/** Everything needed to put a deleted set / exercise back exactly as it was (undo). */
export interface DeletedSetSnapshot { set: WorkoutSet }
export interface DeletedExerciseSnapshot {
  exercise: typeof workoutExercises.$inferSelect;
  sets: WorkoutSet[];
}

const hasValues = (s: WorkoutSet) =>
  s.isCompleted || s.weightKg != null || s.reps != null || s.durationSec != null || s.distanceM != null;

export function workoutsRepo(db: AppDb) {
  const records = recordsRepo(db);

  const profileWeight = (): number | null =>
    db.select({ w: userProfiles.weightKg }).from(userProfiles).limit(1).get()?.w ?? null;

  const getSession = (id: string): WorkoutSession => {
    const s = db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).get();
    if (!s) throw new DataError('Workout not found', 'not_found');
    return s;
  };

  const loadExercises = (sessionId: string): WorkoutExerciseDetail[] => {
    const rows = db
      .select({
        id: workoutExercises.id, exerciseId: workoutExercises.exerciseId, position: workoutExercises.position,
        restSec: workoutExercises.restSec, notes: workoutExercises.notes, name: exercises.name,
        muscleGroupId: exercises.muscleGroupId, trackingType: exercises.trackingType,
      })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
      .where(eq(workoutExercises.sessionId, sessionId))
      .orderBy(asc(workoutExercises.position))
      .all();
    const ids = rows.map((r) => r.id);
    const sets = ids.length
      ? db.select().from(workoutSets).where(inArray(workoutSets.workoutExerciseId, ids)).orderBy(asc(workoutSets.setOrder)).all()
      : [];
    return rows.map((r) => ({
      ...r,
      trackingType: r.trackingType as TrackingType,
      sets: sets.filter((s) => s.workoutExerciseId === r.id),
    }));
  };

  /** Recomputes the denormalised totals on a session from its sets. */
  const recalc = (tx: Tx | AppDb, sessionId: string, now: number) => {
    const exs = db
      .select({ id: workoutExercises.id, tracking: exercises.trackingType })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
      .where(eq(workoutExercises.sessionId, sessionId))
      .all();
    const bw = profileWeight();
    let volume = 0;
    let setCount = 0;
    for (const e of exs) {
      const sets = db.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, e.id)).all();
      volume += totalVolumeKg(sets, e.tracking as TrackingType, bw);
      setCount += sets.filter((s) => s.isCompleted).length;
    }
    tx.update(workoutSessions).set({ totalVolumeKg: volume, setCount, updatedAt: now }).where(eq(workoutSessions.id, sessionId)).run();
  };

  const nextSetOrder = (weId: string): number =>
    (db.select({ m: max(workoutSets.setOrder) }).from(workoutSets).where(eq(workoutSets.workoutExerciseId, weId)).get()?.m ?? 0) + 1;

  /** Sets from the most recent completed workout containing this exercise, before `beforeStartedAt`. */
  const previousSets = (exerciseId: string, beforeStartedAt: number = Date.now() + 1): WorkoutSet[] => {
    const last = db
      .select({ weId: workoutExercises.id, startedAt: workoutSessions.startedAt })
      .from(workoutExercises)
      .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
      .where(and(eq(workoutExercises.exerciseId, exerciseId), eq(workoutSessions.status, 'completed'), sql`${workoutSessions.startedAt} < ${beforeStartedAt}`))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1)
      .get();
    if (!last) return [];
    return db.select().from(workoutSets)
      .where(and(eq(workoutSets.workoutExerciseId, last.weId), eq(workoutSets.isCompleted, true)))
      .orderBy(asc(workoutSets.setOrder)).all();
  };

  return {
    previousSets,

    getActive(): WorkoutSession | null {
      return db.select().from(workoutSessions).where(eq(workoutSessions.status, 'in_progress')).orderBy(desc(workoutSessions.startedAt)).limit(1).get() ?? null;
    },

    /** Starts an empty workout, or one prefilled from a plan day. Only one workout may be in progress. */
    start(opts: { name?: string; planId?: string; dayOfWeek?: number | null; now?: number } = {}): WorkoutSession {
      const now = opts.now ?? Date.now();
      if (this.getActive()) throw new DataError('Finish or discard your current workout first', 'conflict');
      const id = newId();
      db.transaction((tx) => {
        tx.insert(workoutSessions).values({
          id, name: opts.name?.trim() || 'Workout', planId: opts.planId ?? null, date: localDay(now),
          startedAt: now, status: 'in_progress', createdAt: now, updatedAt: now,
        }).run();
        if (opts.planId) {
          const items = tx.select().from(workoutPlanExercises)
            .where(and(eq(workoutPlanExercises.planId, opts.planId), opts.dayOfWeek == null ? undefined : eq(workoutPlanExercises.dayOfWeek, opts.dayOfWeek)))
            .orderBy(asc(workoutPlanExercises.position)).all();
          items.forEach((it, i) => {
            const weId = newId();
            tx.insert(workoutExercises).values({ id: weId, sessionId: id, exerciseId: it.exerciseId, position: i + 1, restSec: it.restSec }).run();
            for (let n = 1; n <= Math.max(1, it.targetSets); n++) {
              tx.insert(workoutSets).values({
                id: newId(), workoutExerciseId: weId, setOrder: n, weightKg: it.targetWeightKg, reps: it.targetReps,
                durationSec: it.targetDurationSec, distanceM: it.targetDistanceM, isCompleted: false,
              }).run();
            }
          });
        }
      });
      return getSession(id);
    },

    getDetail(id: string): WorkoutDetail {
      return { ...getSession(id), exercises: loadExercises(id) };
    },

    updateMeta(id: string, patch: { name?: string; notes?: string | null; rpe?: number | null }, now: number = Date.now()): void {
      getSession(id);
      if (patch.rpe != null && (patch.rpe < 1 || patch.rpe > 10)) throw new DataError('RPE must be between 1 and 10');
      db.update(workoutSessions).set({
        ...(patch.name !== undefined ? { name: patch.name.trim() || 'Workout' } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.rpe !== undefined ? { rpe: patch.rpe } : {}),
        updatedAt: now,
      }).where(eq(workoutSessions.id, id)).run();
    },

    // ---- Exercises within a workout
    addExercise(sessionId: string, exerciseId: string, now: number = Date.now()): string {
      const s = getSession(sessionId);
      const ex = db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
      if (!ex) throw new DataError('Exercise not found', 'not_found');
      const weId = newId();
      db.transaction((tx) => {
        const pos = (tx.select({ m: max(workoutExercises.position) }).from(workoutExercises).where(eq(workoutExercises.sessionId, sessionId)).get()?.m ?? 0) + 1;
        tx.insert(workoutExercises).values({ id: weId, sessionId, exerciseId, position: pos, restSec: 90 }).run();
        // Prefill from last time: same number of sets, same weights/reps, all unchecked.
        const prev = previousSets(exerciseId, s.startedAt);
        const seeds = prev.length ? prev : [null];
        seeds.forEach((p, i) =>
          tx.insert(workoutSets).values({
            id: newId(), workoutExerciseId: weId, setOrder: i + 1,
            weightKg: p?.weightKg ?? null, reps: p?.reps ?? null, durationSec: p?.durationSec ?? null, distanceM: p?.distanceM ?? null,
            isCompleted: false,
          }).run(),
        );
        tx.update(workoutSessions).set({ updatedAt: now }).where(eq(workoutSessions.id, sessionId)).run();
      });
      return weId;
    },

    removeExercise(weId: string, now: number = Date.now()): DeletedExerciseSnapshot {
      const we = db.select().from(workoutExercises).where(eq(workoutExercises.id, weId)).get();
      if (!we) throw new DataError('Exercise not found in workout', 'not_found');
      const sets = db.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, weId)).orderBy(asc(workoutSets.setOrder)).all();
      db.transaction((tx) => {
        tx.delete(workoutExercises).where(eq(workoutExercises.id, weId)).run(); // sets cascade
        const rest = tx.select().from(workoutExercises).where(eq(workoutExercises.sessionId, we.sessionId)).orderBy(asc(workoutExercises.position)).all();
        rest.forEach((r, i) => { if (r.position !== i + 1) tx.update(workoutExercises).set({ position: i + 1 }).where(eq(workoutExercises.id, r.id)).run(); });
        recalc(tx, we.sessionId, now);
      });
      return { exercise: we, sets };
    },

    /** Undo for removeExercise. Re-inserts at its old position. */
    restoreExercise(snap: DeletedExerciseSnapshot, now: number = Date.now()): void {
      const { exercise, sets } = snap;
      db.transaction((tx) => {
        const later = tx.select().from(workoutExercises)
          .where(and(eq(workoutExercises.sessionId, exercise.sessionId), gte(workoutExercises.position, exercise.position)))
          .orderBy(desc(workoutExercises.position)).all();
        for (const l of later) tx.update(workoutExercises).set({ position: l.position + 1 }).where(eq(workoutExercises.id, l.id)).run();
        tx.insert(workoutExercises).values(exercise).run();
        for (const s of sets) tx.insert(workoutSets).values(s).run();
        recalc(tx, exercise.sessionId, now);
      });
    },

    /** Persists a new order. `orderedIds` must contain exactly the session's workout-exercise ids. */
    reorderExercises(sessionId: string, orderedIds: string[]): void {
      const current = db.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.sessionId, sessionId)).all().map((r) => r.id);
      if (current.length !== orderedIds.length || !current.every((id) => orderedIds.includes(id))) {
        throw new DataError('Reorder list does not match the workout');
      }
      db.transaction((tx) => orderedIds.forEach((id, i) => tx.update(workoutExercises).set({ position: i + 1 }).where(eq(workoutExercises.id, id)).run()));
    },

    duplicateExercise(weId: string, now: number = Date.now()): string {
      const we = db.select().from(workoutExercises).where(eq(workoutExercises.id, weId)).get();
      if (!we) throw new DataError('Exercise not found in workout', 'not_found');
      const copy = newId();
      db.transaction((tx) => {
        const later = tx.select().from(workoutExercises)
          .where(and(eq(workoutExercises.sessionId, we.sessionId), sql`${workoutExercises.position} > ${we.position}`))
          .orderBy(desc(workoutExercises.position)).all();
        for (const l of later) tx.update(workoutExercises).set({ position: l.position + 1 }).where(eq(workoutExercises.id, l.id)).run();
        tx.insert(workoutExercises).values({ ...we, id: copy, position: we.position + 1 }).run();
        const sets = tx.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, weId)).orderBy(asc(workoutSets.setOrder)).all();
        for (const s of sets) tx.insert(workoutSets).values({ ...s, id: newId(), workoutExerciseId: copy, isCompleted: false, completedAt: null }).run();
        tx.update(workoutSessions).set({ updatedAt: now }).where(eq(workoutSessions.id, we.sessionId)).run();
      });
      return copy;
    },

    updateExercise(weId: string, patch: { restSec?: number; notes?: string | null }): void {
      if (patch.restSec != null && (patch.restSec < 0 || patch.restSec > 3600)) throw new DataError('Rest time must be 0-3600 seconds');
      db.update(workoutExercises).set(patch).where(eq(workoutExercises.id, weId)).run();
    },

    // ---- Sets
    addSet(weId: string): WorkoutSet {
      const we = db.select().from(workoutExercises).where(eq(workoutExercises.id, weId)).get();
      if (!we) throw new DataError('Exercise not found in workout', 'not_found');
      const order = nextSetOrder(weId);
      const last = db.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, weId)).orderBy(desc(workoutSets.setOrder)).limit(1).get();
      const id = newId();
      db.insert(workoutSets).values({
        id, workoutExerciseId: weId, setOrder: order,
        weightKg: last?.weightKg ?? null, reps: last?.reps ?? null, durationSec: last?.durationSec ?? null, distanceM: last?.distanceM ?? null,
        isCompleted: false,
      }).run();
      return db.select().from(workoutSets).where(eq(workoutSets.id, id)).get()!;
    },

    updateSet(setId: string, patch: SetPatch, now: number = Date.now()): void {
      const s = db.select().from(workoutSets).where(eq(workoutSets.id, setId)).get();
      if (!s) throw new DataError('Set not found', 'not_found');
      for (const [k, v] of Object.entries(patch)) {
        if (k !== 'kind' && v != null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) throw new DataError(`Invalid ${k}`);
      }
      db.transaction((tx) => {
        tx.update(workoutSets).set(patch).where(eq(workoutSets.id, setId)).run();
        const we = tx.select().from(workoutExercises).where(eq(workoutExercises.id, s.workoutExerciseId)).get()!;
        recalc(tx, we.sessionId, now);
      });
    },

    /** Checks or unchecks a set. Returns the new completed state. */
    toggleSetComplete(setId: string, now: number = Date.now()): boolean {
      const s = db.select().from(workoutSets).where(eq(workoutSets.id, setId)).get();
      if (!s) throw new DataError('Set not found', 'not_found');
      const next = !s.isCompleted;
      db.transaction((tx) => {
        tx.update(workoutSets).set({ isCompleted: next, completedAt: next ? now : null }).where(eq(workoutSets.id, setId)).run();
        const we = tx.select().from(workoutExercises).where(eq(workoutExercises.id, s.workoutExerciseId)).get()!;
        recalc(tx, we.sessionId, now);
      });
      return next;
    },

    deleteSet(setId: string, now: number = Date.now()): DeletedSetSnapshot {
      const s = db.select().from(workoutSets).where(eq(workoutSets.id, setId)).get();
      if (!s) throw new DataError('Set not found', 'not_found');
      db.transaction((tx) => {
        tx.delete(workoutSets).where(eq(workoutSets.id, setId)).run();
        const later = tx.select().from(workoutSets)
          .where(and(eq(workoutSets.workoutExerciseId, s.workoutExerciseId), sql`${workoutSets.setOrder} > ${s.setOrder}`))
          .orderBy(asc(workoutSets.setOrder)).all();
        for (const l of later) tx.update(workoutSets).set({ setOrder: l.setOrder - 1 }).where(eq(workoutSets.id, l.id)).run();
        const we = tx.select().from(workoutExercises).where(eq(workoutExercises.id, s.workoutExerciseId)).get()!;
        recalc(tx, we.sessionId, now);
      });
      return { set: s };
    },

    restoreSet(snap: DeletedSetSnapshot, now: number = Date.now()): void {
      const s = snap.set;
      db.transaction((tx) => {
        const later = tx.select().from(workoutSets)
          .where(and(eq(workoutSets.workoutExerciseId, s.workoutExerciseId), gte(workoutSets.setOrder, s.setOrder)))
          .orderBy(desc(workoutSets.setOrder)).all();
        for (const l of later) tx.update(workoutSets).set({ setOrder: l.setOrder + 1 }).where(eq(workoutSets.id, l.id)).run();
        tx.insert(workoutSets).values(s).run();
        const we = tx.select().from(workoutExercises).where(eq(workoutExercises.id, s.workoutExerciseId)).get()!;
        recalc(tx, we.sessionId, now);
      });
    },

    // ---- Lifecycle
    /**
     * Completes the workout: stamps end/duration, drops sets that hold no data at all, recomputes
     * totals and calorie estimate, and re-derives personal records. Returns any new PRs.
     */
    finish(id: string, opts: { rpe?: number | null; notes?: string | null; intensity?: Intensity; now?: number } = {}): { session: WorkoutSession; newRecords: RecordChange[] } {
      const now = opts.now ?? Date.now();
      const s = getSession(id);
      if (s.status === 'completed') throw new DataError('Workout is already completed', 'conflict');
      const completed = db.select({ n: count() }).from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .where(and(eq(workoutExercises.sessionId, id), eq(workoutSets.isCompleted, true))).get()?.n ?? 0;
      if (completed === 0) throw new DataError('Complete at least one set before finishing, or discard the workout', 'invalid');
      if (opts.rpe != null && (opts.rpe < 1 || opts.rpe > 10)) throw new DataError('RPE must be between 1 and 10');

      db.transaction((tx) => {
        const exs = tx.select().from(workoutExercises).where(eq(workoutExercises.sessionId, id)).all();
        for (const e of exs) {
          const sets = tx.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, e.id)).orderBy(asc(workoutSets.setOrder)).all();
          // Only truly empty rows are removed; a set with any entered value is kept even if unchecked.
          const keep = sets.filter(hasValues);
          if (keep.length !== sets.length) {
            tx.delete(workoutSets).where(eq(workoutSets.workoutExerciseId, e.id)).run();
            keep.forEach((k, i) => tx.insert(workoutSets).values({ ...k, setOrder: i + 1 }).run());
          }
        }
        const durationSec = Math.max(0, Math.round((now - s.startedAt) / 1000));
        const w = profileWeight();
        tx.update(workoutSessions).set({
          status: 'completed', endedAt: now, durationSec,
          ...(opts.rpe !== undefined ? { rpe: opts.rpe } : {}),
          ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
          caloriesEstimate: w ? caloriesFromMet(STRENGTH_MET, w, durationSec, opts.intensity ?? 'moderate') : null,
          updatedAt: now,
        }).where(eq(workoutSessions.id, id)).run();
        recalc(tx, id, now);
      });
      const newRecords = records.rebuild();
      return { session: getSession(id), newRecords };
    },

    /** Re-saves totals and records after editing a completed workout. */
    recalculate(id: string, now: number = Date.now()): RecordChange[] {
      getSession(id);
      db.transaction((tx) => recalc(tx, id, now));
      return records.rebuild();
    },

    /** Discards an in-progress workout or deletes a finished one, including all of its sets. */
    remove(id: string): void {
      const s = getSession(id);
      db.delete(workoutSessions).where(eq(workoutSessions.id, id)).run();
      if (s.status === 'completed') records.rebuild();
    },

    // ---- Queries
    history(opts: { from?: string; to?: string; limit?: number; offset?: number } = {}) {
      const conds = [eq(workoutSessions.status, 'completed')];
      if (opts.from) conds.push(gte(workoutSessions.date, opts.from));
      if (opts.to) conds.push(lte(workoutSessions.date, opts.to));
      return db.select().from(workoutSessions).where(and(...conds))
        .orderBy(desc(workoutSessions.startedAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0).all();
    },

    /** Every completed set ever logged for an exercise, newest first, for the per-exercise history view. */
    setHistory(exerciseId: string, limit = 100) {
      return db.select({
        setId: workoutSets.id, date: workoutSessions.date, sessionId: workoutSessions.id, setOrder: workoutSets.setOrder,
        weightKg: workoutSets.weightKg, reps: workoutSets.reps, durationSec: workoutSets.durationSec, distanceM: workoutSets.distanceM,
      })
        .from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id))
        .where(and(eq(workoutExercises.exerciseId, exerciseId), eq(workoutSets.isCompleted, true), eq(workoutSessions.status, 'completed')))
        .orderBy(desc(workoutSessions.startedAt), asc(workoutSets.setOrder)).limit(limit).all();
    },

    /** Deletes all completed workouts (and their sets). Running/cardio/measurements are untouched. */
    clearHistory(): number {
      const n = db.select({ n: count() }).from(workoutSessions).get()?.n ?? 0;
      db.delete(workoutSessions).run();
      records.rebuild();
      return n;
    },
  };
}
