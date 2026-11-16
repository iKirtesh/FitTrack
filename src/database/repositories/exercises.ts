import { and, asc, eq, like, or, sql, count } from 'drizzle-orm';
import { exercises, muscleGroups, workoutExercises, workoutPlanExercises } from '../schema';
import { customExerciseSchema, type CustomExerciseInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type Exercise = Omit<typeof exercises.$inferSelect, 'secondaryMuscles'> & { secondaryMuscles: string[] };

function hydrate(r: typeof exercises.$inferSelect): Exercise {
  let sec: string[] = [];
  try {
    const p: unknown = JSON.parse(r.secondaryMuscles);
    if (Array.isArray(p)) sec = p.filter((s): s is string => typeof s === 'string');
  } catch {
    /* tolerate corrupt JSON */
  }
  return { ...r, secondaryMuscles: sec };
}

export interface ExerciseFilter {
  search?: string;
  muscleGroupId?: string;
  equipment?: string;
  customOnly?: boolean;
}

export function exercisesRepo(db: AppDb) {
  return {
    muscleGroups() {
      return db.select().from(muscleGroups).orderBy(asc(muscleGroups.sortOrder)).all();
    },

    list(filter: ExerciseFilter = {}): Exercise[] {
      const conds = [];
      const q = filter.search?.trim();
      if (q) {
        const pat = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        conds.push(or(sql`${exercises.name} LIKE ${pat} ESCAPE '\\'`, like(exercises.muscleGroupId, pat)));
      }
      if (filter.muscleGroupId) conds.push(eq(exercises.muscleGroupId, filter.muscleGroupId));
      if (filter.equipment) conds.push(eq(exercises.equipment, filter.equipment));
      if (filter.customOnly) conds.push(eq(exercises.isCustom, true));
      return db
        .select()
        .from(exercises)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(exercises.name))
        .all()
        .map(hydrate);
    },

    get(id: string): Exercise | null {
      const r = db.select().from(exercises).where(eq(exercises.id, id)).get();
      return r ? hydrate(r) : null;
    },

    createCustom(input: CustomExerciseInput, now: number = Date.now()): Exercise {
      const d = customExerciseSchema.parse(input);
      const dupe = db
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(eq(exercises.isCustom, true), sql`lower(${exercises.name}) = lower(${d.name})`))
        .get();
      if (dupe) throw new DataError(`You already have a custom exercise named "${d.name}"`, 'conflict');
      const id = newId();
      db.insert(exercises)
        .values({
          id,
          name: d.name,
          muscleGroupId: d.muscleGroupId,
          secondaryMuscles: JSON.stringify(d.secondaryMuscles),
          equipment: d.equipment,
          instructions: d.instructions ?? null,
          difficulty: d.difficulty,
          exerciseType: 'strength',
          trackingType: d.trackingType,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return this.get(id)!;
    },

    updateCustom(id: string, input: CustomExerciseInput, now: number = Date.now()): Exercise {
      const existing = this.get(id);
      if (!existing) throw new DataError('Exercise not found', 'not_found');
      if (!existing.isCustom) throw new DataError('Built-in exercises cannot be edited', 'invalid');
      const d = customExerciseSchema.parse(input);
      db.update(exercises)
        .set({
          name: d.name,
          muscleGroupId: d.muscleGroupId,
          secondaryMuscles: JSON.stringify(d.secondaryMuscles),
          equipment: d.equipment,
          instructions: d.instructions ?? null,
          difficulty: d.difficulty,
          trackingType: d.trackingType,
          updatedAt: now,
        })
        .where(eq(exercises.id, id))
        .run();
      return this.get(id)!;
    },

    usageCount(id: string): number {
      const a = db.select({ n: count() }).from(workoutExercises).where(eq(workoutExercises.exerciseId, id)).get()?.n ?? 0;
      const b = db.select({ n: count() }).from(workoutPlanExercises).where(eq(workoutPlanExercises.exerciseId, id)).get()?.n ?? 0;
      return a + b;
    },

    /** Deleting an exercise that has history would orphan that history, so it is refused. */
    deleteCustom(id: string): void {
      const existing = this.get(id);
      if (!existing) throw new DataError('Exercise not found', 'not_found');
      if (!existing.isCustom) throw new DataError('Built-in exercises cannot be deleted', 'invalid');
      const used = this.usageCount(id);
      if (used > 0) {
        throw new DataError(`"${existing.name}" is used in ${used} workout or plan entries and cannot be deleted`, 'in_use');
      }
      db.delete(exercises).where(eq(exercises.id, id)).run();
    },
  };
}
