import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { fitnessGoals, runningSessions, workoutSessions, bodyMeasurements, userProfiles } from '../schema';
import { goalSchema, type GoalInput } from '@/types/schemas';
import { goalProgress } from '@/services/calculations';
import { localDay, startOfWeek, addDays } from '@/utils/dates';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type FitnessGoal = typeof fitnessGoals.$inferSelect;
export interface GoalWithProgress extends FitnessGoal {
  current: number | null;
  /** 0..1 */
  progress: number;
  reached: boolean;
}

export function goalsRepo(db: AppDb) {
  const currentWeight = (): number | null =>
    db.select({ w: bodyMeasurements.weightKg }).from(bodyMeasurements).where(sql`${bodyMeasurements.weightKg} IS NOT NULL`).orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt)).limit(1).get()?.w
    ?? db.select({ w: userProfiles.weightKg }).from(userProfiles).limit(1).get()?.w ?? null;

  const measure = (g: FitnessGoal, today: string): number | null => {
    const weekStart = startOfWeek(today);
    switch (g.type) {
      case 'weight': return currentWeight();
      case 'workouts_per_week':
        return db.select({ n: sql<number>`count(*)` }).from(workoutSessions).where(and(eq(workoutSessions.status, 'completed'), gte(workoutSessions.date, weekStart), lte(workoutSessions.date, addDays(weekStart, 6)))).get()?.n ?? 0;
      case 'weekly_distance':
        return db.select({ m: sql<number>`coalesce(sum(${runningSessions.distanceM}), 0)` }).from(runningSessions).where(and(eq(runningSessions.status, 'completed'), gte(runningSessions.date, weekStart), lte(runningSessions.date, addDays(weekStart, 6)))).get()?.m ?? 0;
      default: return null;
    }
  };

  const withProgress = (g: FitnessGoal, today: string): GoalWithProgress => {
    const current = measure(g, today);
    if (current == null) return { ...g, current, progress: 0, reached: false };
    if (g.type === 'weight') {
      const start = g.startValue ?? current;
      const reached = start === g.targetValue ? current === g.targetValue : start > g.targetValue ? current <= g.targetValue : current >= g.targetValue;
      return { ...g, current, progress: reached ? 1 : goalProgress(start, current, g.targetValue), reached };
    }
    return { ...g, current, progress: Math.min(1, current / g.targetValue), reached: current >= g.targetValue };
  };

  return {
    create(input: GoalInput, now: number = Date.now()): FitnessGoal {
      const d = goalSchema.parse(input);
      if (d.targetValue <= 0) throw new DataError('Target must be greater than zero');
      const start = d.type === 'weight' ? d.startValue ?? currentWeight() : null;
      const id = newId();
      db.insert(fitnessGoals).values({ id, type: d.type, title: d.title, targetValue: d.targetValue, startValue: start, unit: d.unit ?? null, deadline: d.deadline ?? null, createdAt: now, updatedAt: now }).run();
      return db.select().from(fitnessGoals).where(eq(fitnessGoals.id, id)).get()!;
    },

    /** Lists goals with live progress. Weight goals that have been reached are marked completed once. */
    list(opts: { status?: 'active' | 'completed' | 'abandoned' } = {}, today: string = localDay(), now: number = Date.now()): GoalWithProgress[] {
      const rows = db.select().from(fitnessGoals).where(opts.status ? eq(fitnessGoals.status, opts.status) : undefined).orderBy(desc(fitnessGoals.createdAt)).all();
      return rows.map((g) => {
        const gp = withProgress(g, today);
        if (g.status === 'active' && g.type === 'weight' && gp.reached) {
          db.update(fitnessGoals).set({ status: 'completed', completedAt: now, updatedAt: now }).where(eq(fitnessGoals.id, g.id)).run();
          return { ...gp, status: 'completed', completedAt: now };
        }
        return gp;
      });
    },

    abandon(id: string): void {
      if (!db.update(fitnessGoals).set({ status: 'abandoned', updatedAt: Date.now() }).where(eq(fitnessGoals.id, id)).run().changes) throw new DataError('Goal not found', 'not_found');
    },

    remove(id: string): void {
      if (!db.delete(fitnessGoals).where(eq(fitnessGoals.id, id)).run().changes) throw new DataError('Goal not found', 'not_found');
    },
  };
}
