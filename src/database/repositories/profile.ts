import { eq } from 'drizzle-orm';
import { userProfiles, fitnessGoals, appSettings } from '../schema';
import { profileInputSchema, type ProfileInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type UserProfile = Omit<typeof userProfiles.$inferSelect, 'preferredWorkoutDays'> & { preferredWorkoutDays: number[] };

function hydrate(row: typeof userProfiles.$inferSelect): UserProfile {
  let days: number[] = [];
  try {
    const parsed: unknown = JSON.parse(row.preferredWorkoutDays);
    if (Array.isArray(parsed)) days = parsed.filter((n): n is number => typeof n === 'number');
  } catch {
    // Corrupt JSON must not make the profile unreadable; fall back to no preferred days.
  }
  return { ...row, preferredWorkoutDays: days };
}

export function profileRepo(db: AppDb) {
  return {
    get(): UserProfile | null {
      const row = db.select().from(userProfiles).limit(1).get();
      return row ? hydrate(row) : null;
    },

    create(input: ProfileInput, now: number = Date.now()): UserProfile {
      const data = profileInputSchema.parse(input);
      if (db.select().from(userProfiles).limit(1).get()) {
        throw new DataError('A profile already exists', 'conflict');
      }
      const id = newId();
      db.insert(userProfiles)
        .values({
          id,
          ...data,
          preferredWorkoutDays: JSON.stringify(data.preferredWorkoutDays),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return this.get()!;
    },

    update(patch: Partial<ProfileInput>, now: number = Date.now()): UserProfile {
      const current = this.get();
      if (!current) throw new DataError('No profile to update', 'not_found');
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = current;
      const merged = profileInputSchema.parse({ ...rest, ...patch });
      db.update(userProfiles)
        .set({ ...merged, preferredWorkoutDays: JSON.stringify(merged.preferredWorkoutDays), updatedAt: now })
        .where(eq(userProfiles.id, current.id))
        .run();
      return this.get()!;
    },

    /** Removes only the profile row. Workouts, runs and measurements are kept. */
    remove(): void {
      db.delete(userProfiles).run();
    },
  };
}

export function settingsRepo(db: AppDb) {
  return {
    get<T>(key: string, fallback: T): T {
      const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
      if (!row) return fallback;
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown, now: number = Date.now()): void {
      const json = JSON.stringify(value);
      db.insert(appSettings)
        .values({ key, value: json, updatedAt: now })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: json, updatedAt: now } })
        .run();
    },
    remove(key: string): void {
      db.delete(appSettings).where(eq(appSettings.key, key)).run();
    },
    all(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const r of db.select().from(appSettings).all()) {
        try {
          out[r.key] = JSON.parse(r.value);
        } catch {
          out[r.key] = r.value;
        }
      }
      return out;
    },
  };
}

export { fitnessGoals };
