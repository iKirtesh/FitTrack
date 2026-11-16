import { and, asc, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { exercises, workoutPlanExercises, workoutPlans, workoutSessions, runningSessions, cardioSessions } from '../schema';
import { PLAN_TEMPLATES } from '@/constants/plans';
import { dayRange, localDay, parseDay } from '@/utils/dates';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type WorkoutPlan = typeof workoutPlans.$inferSelect;
export type PlanItem = typeof workoutPlanExercises.$inferSelect;
export interface PlanItemInput {
  dayOfWeek: number | null;
  dayName?: string | null;
  exerciseId: string;
  targetSets: number;
  targetReps?: number | null;
  targetWeightKg?: number | null;
  targetDurationSec?: number | null;
  targetDistanceM?: number | null;
  restSec?: number;
}

export interface CalendarDay {
  date: string;
  planned: string[]; // plan day names scheduled for this date
  workouts: number;
  runs: number;
  cardio: number;
  status: 'completed' | 'missed' | 'planned' | 'rest' | 'extra';
}

export function plansRepo(db: AppDb) {
  const get = (id: string) => {
    const p = db.select().from(workoutPlans).where(eq(workoutPlans.id, id)).get();
    if (!p) throw new DataError('Plan not found', 'not_found');
    return p;
  };
  const validate = (it: PlanItemInput) => {
    if (it.dayOfWeek != null && (!Number.isInteger(it.dayOfWeek) || it.dayOfWeek < 0 || it.dayOfWeek > 6)) throw new DataError('Day of week must be 0-6');
    if (!Number.isInteger(it.targetSets) || it.targetSets < 1 || it.targetSets > 20) throw new DataError('Sets must be between 1 and 20');
    if (it.targetReps != null && (it.targetReps < 1 || it.targetReps > 1000)) throw new DataError('Reps must be between 1 and 1000');
    if (it.restSec != null && (it.restSec < 0 || it.restSec > 3600)) throw new DataError('Rest must be 0-3600 seconds');
  };

  return {
    list(): (WorkoutPlan & { exerciseCount: number })[] {
      return db.select().from(workoutPlans).orderBy(desc(workoutPlans.isActive), asc(workoutPlans.name)).all().map((p) => ({
        ...p,
        exerciseCount: db.select({ n: sql<number>`count(*)` }).from(workoutPlanExercises).where(eq(workoutPlanExercises.planId, p.id)).get()?.n ?? 0,
      }));
    },

    get(id: string) {
      const plan = get(id);
      const items = db.select({ item: workoutPlanExercises, name: exercises.name, trackingType: exercises.trackingType })
        .from(workoutPlanExercises).innerJoin(exercises, eq(workoutPlanExercises.exerciseId, exercises.id))
        .where(eq(workoutPlanExercises.planId, id)).orderBy(asc(workoutPlanExercises.dayOfWeek), asc(workoutPlanExercises.position)).all();
      return { plan, items: items.map((r) => ({ ...r.item, exerciseName: r.name, trackingType: r.trackingType })) };
    },

    create(input: { name: string; description?: string | null }, now: number = Date.now()): WorkoutPlan {
      const name = input.name.trim();
      if (!name) throw new DataError('Plan name is required');
      if (db.select({ id: workoutPlans.id }).from(workoutPlans).where(sql`lower(${workoutPlans.name}) = lower(${name})`).get()) throw new DataError(`A plan named "${name}" already exists`, 'conflict');
      const id = newId();
      db.insert(workoutPlans).values({ id, name, description: input.description ?? null, createdAt: now, updatedAt: now }).run();
      return get(id);
    },

    rename(id: string, name: string, description?: string | null, now: number = Date.now()): void {
      get(id);
      const n = name.trim();
      if (!n) throw new DataError('Plan name is required');
      if (db.select({ id: workoutPlans.id }).from(workoutPlans).where(and(sql`lower(${workoutPlans.name}) = lower(${n})`, ne(workoutPlans.id, id))).get()) throw new DataError(`A plan named "${n}" already exists`, 'conflict');
      db.update(workoutPlans).set({ name: n, ...(description !== undefined ? { description } : {}), updatedAt: now }).where(eq(workoutPlans.id, id)).run();
    },

    /** Replaces all exercises of a plan atomically. Positions are assigned per day in array order. */
    setItems(planId: string, items: PlanItemInput[], now: number = Date.now()): void {
      get(planId);
      items.forEach(validate);
      db.transaction((tx) => {
        tx.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, planId)).run();
        const posByDay = new Map<number | null, number>();
        for (const it of items) {
          const pos = (posByDay.get(it.dayOfWeek) ?? 0) + 1;
          posByDay.set(it.dayOfWeek, pos);
          tx.insert(workoutPlanExercises).values({
            id: newId(), planId, dayOfWeek: it.dayOfWeek, dayName: it.dayName ?? null, exerciseId: it.exerciseId, position: pos,
            targetSets: it.targetSets, targetReps: it.targetReps ?? null, targetWeightKg: it.targetWeightKg ?? null,
            targetDurationSec: it.targetDurationSec ?? null, targetDistanceM: it.targetDistanceM ?? null, restSec: it.restSec ?? 90,
          }).run();
        }
        tx.update(workoutPlans).set({ updatedAt: now }).where(eq(workoutPlans.id, planId)).run();
      });
    },

    duplicate(id: string, now: number = Date.now()): WorkoutPlan {
      const src = get(id);
      let name = `${src.name} (copy)`;
      for (let n = 2; db.select({ id: workoutPlans.id }).from(workoutPlans).where(sql`lower(${workoutPlans.name}) = lower(${name})`).get(); n++) name = `${src.name} (copy ${n})`;
      const copy = newId();
      db.transaction((tx) => {
        tx.insert(workoutPlans).values({ id: copy, name, description: src.description, isActive: false, createdAt: now, updatedAt: now }).run();
        for (const it of tx.select().from(workoutPlanExercises).where(eq(workoutPlanExercises.planId, id)).all()) {
          tx.insert(workoutPlanExercises).values({ ...it, id: newId(), planId: copy }).run();
        }
      });
      return get(copy);
    },

    /** Only one plan can be the active schedule. Pass false to deactivate. */
    setActive(id: string, active = true): void {
      get(id);
      db.transaction((tx) => {
        if (active) tx.update(workoutPlans).set({ isActive: false }).run();
        tx.update(workoutPlans).set({ isActive: active }).where(eq(workoutPlans.id, id)).run();
      });
    },

    getActive(): WorkoutPlan | null {
      return db.select().from(workoutPlans).where(eq(workoutPlans.isActive, true)).get() ?? null;
    },

    /** Deleting a plan keeps past workouts (their plan reference is cleared). */
    remove(id: string): void {
      get(id);
      db.delete(workoutPlans).where(eq(workoutPlans.id, id)).run();
    },

    createFromTemplate(templateId: string, now: number = Date.now()): WorkoutPlan {
      const t = PLAN_TEMPLATES.find((x) => x.id === templateId);
      if (!t) throw new DataError('Unknown template', 'not_found');
      let name = t.name;
      for (let n = 2; db.select({ id: workoutPlans.id }).from(workoutPlans).where(sql`lower(${workoutPlans.name}) = lower(${name})`).get(); n++) name = `${t.name} ${n}`;
      const plan = this.create({ name, description: t.description }, now);
      const items: PlanItemInput[] = [];
      for (const day of t.days) {
        for (const ex of day.exercises) {
          const row = db.select({ id: exercises.id, tracking: exercises.trackingType }).from(exercises).where(eq(exercises.seedKey, ex.key)).get();
          if (!row) throw new DataError(`Template references a missing exercise: ${ex.key}`);
          items.push({
            dayOfWeek: day.dayOfWeek, dayName: day.name, exerciseId: row.id, targetSets: ex.sets,
            targetReps: row.tracking === 'timed' || row.tracking === 'duration' ? null : ex.reps,
            targetDurationSec: row.tracking === 'timed' ? 45 : null, restSec: ex.rest ?? 90,
          });
        }
      }
      this.setItems(plan.id, items, now);
      return get(plan.id);
    },

    /**
     * Calendar for [from, to]. "Missed" is only reported for scheduled days that are strictly in
     * the past, on or after the plan's creation day, with no completed workout that day.
     */
    calendar(from: string, to: string, today: string = localDay()): CalendarDay[] {
      const active = this.getActive();
      const scheduled = new Map<number, string[]>();
      if (active) {
        for (const r of db.select({ d: workoutPlanExercises.dayOfWeek, n: workoutPlanExercises.dayName }).from(workoutPlanExercises).where(and(eq(workoutPlanExercises.planId, active.id), sql`${workoutPlanExercises.dayOfWeek} IS NOT NULL`)).groupBy(workoutPlanExercises.dayOfWeek, workoutPlanExercises.dayName).all()) {
          scheduled.set(r.d!, [...(scheduled.get(r.d!) ?? []), r.n ?? active.name]);
        }
      }
      const count = (rows: { date: string }[]) => rows.reduce((m, r) => m.set(r.date, (m.get(r.date) ?? 0) + 1), new Map<string, number>());
      const w = count(db.select({ date: workoutSessions.date }).from(workoutSessions).where(and(eq(workoutSessions.status, 'completed'), gte(workoutSessions.date, from), lte(workoutSessions.date, to))).all());
      const r = count(db.select({ date: runningSessions.date }).from(runningSessions).where(and(eq(runningSessions.status, 'completed'), gte(runningSessions.date, from), lte(runningSessions.date, to))).all());
      const c = count(db.select({ date: cardioSessions.date }).from(cardioSessions).where(and(gte(cardioSessions.date, from), lte(cardioSessions.date, to))).all());
      const createdDay = active ? localDay(active.createdAt) : null;
      return dayRange(from, to).map((date) => {
        const planned = scheduled.get(parseDay(date).getDay()) ?? [];
        const workouts = w.get(date) ?? 0, runs = r.get(date) ?? 0, cardio = c.get(date) ?? 0;
        let status: CalendarDay['status'];
        if (planned.length && workouts > 0) status = 'completed';
        else if (planned.length && date < today && createdDay && date >= createdDay) status = 'missed';
        else if (planned.length && date >= today) status = 'planned';
        else if (workouts + runs + cardio > 0) status = 'extra';
        else status = 'rest';
        return { date, planned, workouts, runs, cardio, status };
      });
    },
  };
}

