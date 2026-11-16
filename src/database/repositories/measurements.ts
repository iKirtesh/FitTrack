import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { bodyMeasurements, userProfiles } from '../schema';
import { measurementSchema, type MeasurementInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { bmi } from '@/services/calculations';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;

export function measurementsRepo(db: AppDb) {
  const get = (id: string) => {
    const m = db.select().from(bodyMeasurements).where(eq(bodyMeasurements.id, id)).get();
    if (!m) throw new DataError('Measurement not found', 'not_found');
    return m;
  };
  return {
    create(input: MeasurementInput, now: number = Date.now()): BodyMeasurement {
      const d = measurementSchema.parse(input);
      const id = newId();
      db.transaction((tx) => {
        tx.insert(bodyMeasurements).values({ id, ...d, createdAt: now }).run();
        // Keep the profile's current weight in step with the newest weigh-in.
        if (d.weightKg != null) {
          const newest = tx.select({ date: bodyMeasurements.date }).from(bodyMeasurements).where(sql`${bodyMeasurements.weightKg} IS NOT NULL`).orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt)).limit(1).get();
          if (newest && newest.date <= d.date) tx.update(userProfiles).set({ weightKg: d.weightKg, updatedAt: now }).run();
        }
      });
      return get(id);
    },

    update(id: string, input: MeasurementInput): BodyMeasurement {
      get(id);
      const d = measurementSchema.parse(input);
      db.update(bodyMeasurements).set(d).where(eq(bodyMeasurements.id, id)).run();
      return get(id);
    },

    remove(id: string): void {
      get(id);
      db.delete(bodyMeasurements).where(eq(bodyMeasurements.id, id)).run();
    },

    list(opts: { from?: string; to?: string; limit?: number } = {}): BodyMeasurement[] {
      const conds = [];
      if (opts.from) conds.push(gte(bodyMeasurements.date, opts.from));
      if (opts.to) conds.push(lte(bodyMeasurements.date, opts.to));
      return db.select().from(bodyMeasurements).where(conds.length ? and(...conds) : undefined).orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt)).limit(opts.limit ?? 500).all();
    },

    weightSeries(from?: string): { date: string; weightKg: number }[] {
      return db.select({ date: bodyMeasurements.date, weightKg: bodyMeasurements.weightKg }).from(bodyMeasurements)
        .where(and(sql`${bodyMeasurements.weightKg} IS NOT NULL`, from ? gte(bodyMeasurements.date, from) : undefined))
        .orderBy(asc(bodyMeasurements.date), asc(bodyMeasurements.createdAt)).all() as { date: string; weightKg: number }[];
    },

    latest(): BodyMeasurement | null {
      return db.select().from(bodyMeasurements).orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt)).limit(1).get() ?? null;
    },

    /** BMI is calculated from the latest weight and the profile height. It is a screening ratio, not a diagnosis. */
    currentBmi(): number | null {
      const p = db.select().from(userProfiles).limit(1).get();
      if (!p?.heightCm || !p.weightKg) return null;
      return bmi(p.weightKg, p.heightCm);
    },
  };
}
