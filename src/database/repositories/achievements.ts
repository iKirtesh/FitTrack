import { and, eq, sql } from 'drizzle-orm';
import { achievements, bodyMeasurements, cardioSessions, fitnessGoals, personalRecords, runningSessions, workoutExercises, workoutSessions } from '../schema';
import { ACHIEVEMENTS, type AchievementStats } from '@/constants/achievements';
import { longestStreak } from './records';
import { startOfWeek } from '@/utils/dates';
import type { AppDb } from '@/types/db';

export function gatherStats(db: AppDb): AchievementStats {
  const completed = db.select().from(workoutSessions).where(eq(workoutSessions.status, 'completed')).all();
  const runs = db.select().from(runningSessions).where(eq(runningSessions.status, 'completed')).all();
  const cardio = db.select({ d: cardioSessions.date }).from(cardioSessions).all();
  const perWeek = new Map<string, number>();
  for (const w of completed) perWeek.set(startOfWeek(w.date), (perWeek.get(startOfWeek(w.date)) ?? 0) + 1);
  const distinct = db.select({ n: sql<number>`count(distinct ${workoutExercises.exerciseId})` }).from(workoutExercises)
    .innerJoin(workoutSessions, eq(workoutExercises.sessionId, workoutSessions.id)).where(eq(workoutSessions.status, 'completed')).get()?.n ?? 0;
  const liftingPrs = db.select({ n: sql<number>`count(*)` }).from(personalRecords).where(sql`${personalRecords.subjectId} IS NOT NULL`).get()?.n ?? 0;
  return {
    workouts: completed.length,
    runs: runs.length,
    runDistanceM: runs.reduce((a, r) => a + r.distanceM, 0),
    cardioSessions: cardio.length,
    totalVolumeKg: completed.reduce((a, w) => a + w.totalVolumeKg, 0),
    longestStreakDays: longestStreak([...completed.map((w) => w.date), ...runs.map((r) => r.date), ...cardio.map((c) => c.d)]).length,
    prCount: liftingPrs,
    measurements: db.select({ n: sql<number>`count(*)` }).from(bodyMeasurements).get()?.n ?? 0,
    weightGoalReached: (db.select({ n: sql<number>`count(*)` }).from(fitnessGoals).where(and(eq(fitnessGoals.type, 'weight'), eq(fitnessGoals.status, 'completed'))).get()?.n ?? 0) > 0,
    longestRunM: runs.reduce((a, r) => Math.max(a, r.distanceM), 0),
    fiveKDone: runs.some((r) => r.distanceM >= 5000),
    workoutsInBestWeek: Math.max(0, ...perWeek.values()),
    distinctExercises: distinct,
  };
}

export function achievementsRepo(db: AppDb) {
  return {
    /** All definitions with unlock state and progress, so the UI can show exactly what is left to earn. */
    list() {
      const stats = gatherStats(db);
      const unlocked = new Map(db.select().from(achievements).all().map((a) => [a.key, a]));
      return ACHIEVEMENTS.map((def) => ({
        key: def.key, title: def.title, rule: def.rule, icon: def.icon,
        unlockedAt: unlocked.get(def.key)?.unlockedAt ?? null,
        evidence: unlocked.get(def.key)?.evidence ?? null,
        progress: def.progress ? def.progress(stats) : null,
      }));
    },

    /**
     * Brings stored unlocks in line with the data: new ones are added, ones whose data no longer
     * exists (e.g. history was deleted) are removed. Returns the newly unlocked titles.
     */
    evaluate(now: number = Date.now()): { key: string; title: string }[] {
      const stats = gatherStats(db);
      const have = new Set(db.select({ k: achievements.key }).from(achievements).all().map((r) => r.k));
      const fresh: { key: string; title: string }[] = [];
      db.transaction((tx) => {
        for (const def of ACHIEVEMENTS) {
          const met = def.met(stats);
          if (met && !have.has(def.key)) {
            tx.insert(achievements).values({ key: def.key, unlockedAt: now, evidence: def.rule }).run();
            fresh.push({ key: def.key, title: def.title });
          } else if (!met && have.has(def.key)) {
            tx.delete(achievements).where(eq(achievements.key, def.key)).run();
          }
        }
      });
      return fresh;
    },
  };
}

