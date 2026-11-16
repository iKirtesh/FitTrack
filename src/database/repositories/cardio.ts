import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { cardioSessions, userProfiles } from '../schema';
import { CARDIO_ACTIVITIES, type Intensity } from '@/constants/activities';
import { caloriesFromMet } from '@/services/calculations';
import { speedMps } from '@/services/running';
import { cardioSchema, type CardioInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import { recordsRepo } from './records';
import type { AppDb } from '@/types/db';

export type CardioSession = typeof cardioSessions.$inferSelect;

export function cardioRepo(db: AppDb) {
  return {
    create(input: CardioInput): CardioSession {
      const d = cardioSchema.parse(input);
      if (d.activityType === 'custom' && !d.customName?.trim()) throw new DataError('Name your custom activity');
      if (d.maxHeartRate != null && d.avgHeartRate != null && d.maxHeartRate < d.avgHeartRate) throw new DataError('Max heart rate cannot be below average');
      const base = CARDIO_ACTIVITIES.find((a) => a.id === d.activityType);
      if (!base) throw new DataError('Unknown cardio activity');
      const dupe = db.select({ id: cardioSessions.id }).from(cardioSessions)
        .where(and(eq(cardioSessions.startedAt, d.startedAt), eq(cardioSessions.durationSec, d.durationSec), eq(cardioSessions.activityType, d.activityType))).get();
      if (dupe) throw new DataError('This activity has already been logged', 'conflict');
      const w = db.select({ w: userProfiles.weightKg }).from(userProfiles).limit(1).get()?.w ?? null;
      // An explicit calorie value typed by the user wins; otherwise a MET estimate (needs bodyweight).
      const calories = d.caloriesEstimate ?? (w ? caloriesFromMet(base.met, w, d.durationSec, (d.intensity ?? 'moderate') as Intensity) : null);
      const id = newId();
      db.insert(cardioSessions).values({
        id, activityType: d.activityType, customName: d.customName?.trim() || null, date: d.date, startedAt: d.startedAt,
        durationSec: d.durationSec, distanceM: d.distanceM ?? null, caloriesEstimate: calories,
        avgSpeedMps: d.distanceM ? speedMps(d.distanceM, d.durationSec) : null,
        avgHeartRate: d.avgHeartRate ?? null, maxHeartRate: d.maxHeartRate ?? null, intensity: d.intensity ?? null,
        notes: d.notes ?? null, createdAt: Date.now(),
      }).run();
      recordsRepo(db).rebuild(); // streak records include cardio days
      return db.select().from(cardioSessions).where(eq(cardioSessions.id, id)).get()!;
    },

    list(opts: { from?: string; to?: string; limit?: number; offset?: number } = {}): CardioSession[] {
      const conds = [];
      if (opts.from) conds.push(gte(cardioSessions.date, opts.from));
      if (opts.to) conds.push(lte(cardioSessions.date, opts.to));
      return db.select().from(cardioSessions).where(conds.length ? and(...conds) : undefined).orderBy(desc(cardioSessions.startedAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0).all();
    },

    remove(id: string): void {
      const r = db.delete(cardioSessions).where(eq(cardioSessions.id, id)).run();
      if (!r.changes) throw new DataError('Activity not found', 'not_found');
      recordsRepo(db).rebuild();
    },
  };
}
