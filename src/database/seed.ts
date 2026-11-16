import { MUSCLE_GROUPS } from '@/constants/exercise';
import { BUILT_IN_COUNTERS } from '@/constants/counters';
import { newId } from '@/utils/id';
import { EXERCISE_SEED } from './seed-exercises';
import { activityCounters, exercises, muscleGroups } from './schema';
import type { AppDb } from '@/types/db';

/**
 * Inserts reference data that is part of the app (muscle groups, built-in exercises and
 * counters). Every insert is keyed on a stable key and `onConflictDoNothing`, so it is safe to
 * run on every launch and never overwrites or duplicates anything the user edited.
 */
export function seedReferenceData(db: AppDb, now: number = Date.now()): void {
  db.transaction((tx) => {
    MUSCLE_GROUPS.forEach((g, i) =>
      tx.insert(muscleGroups).values({ id: g.id, name: g.name, sortOrder: i }).onConflictDoNothing().run(),
    );
    for (const e of EXERCISE_SEED) {
      tx.insert(exercises)
        .values({
          id: newId(),
          name: e.name,
          muscleGroupId: e.muscle,
          secondaryMuscles: JSON.stringify(e.secondary ?? []),
          equipment: e.equipment,
          instructions: e.how,
          difficulty: e.difficulty ?? 'intermediate',
          exerciseType: e.type ?? 'strength',
          trackingType: e.tracking ?? 'weight_reps',
          isCustom: false,
          seedKey: e.key,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
    BUILT_IN_COUNTERS.forEach((c, i) =>
      tx
        .insert(activityCounters)
        .values({
          id: newId(),
          name: c.name,
          unit: c.unit,
          step: c.step,
          dailyTarget: c.dailyTarget,
          isBuiltIn: true,
          builtInKey: c.key,
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run(),
    );
  });
}
