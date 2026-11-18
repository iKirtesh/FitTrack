import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { activityCounters, counterEntries, dailyActivity } from '../schema';
import { counterSchema, type CounterInput } from '@/types/schemas';
import { localDay, addDays, dayRange, startOfWeek } from '@/utils/dates';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type Counter = typeof activityCounters.$inferSelect;
export interface CounterToday extends Counter { today: number }

export function countersRepo(db: AppDb) {
  const getCounter = (id: string): Counter => {
    const c = db.select().from(activityCounters).where(eq(activityCounters.id, id)).get();
    if (!c) throw new DataError('Counter not found', 'not_found');
    return c;
  };
  const dayTotal = (counterId: string, date: string): number =>
    db.select({ t: sql<number>`coalesce(sum(${counterEntries.delta}), 0)` }).from(counterEntries)
      .where(and(eq(counterEntries.counterId, counterId), eq(counterEntries.date, date))).get()?.t ?? 0;

  return {
    list(opts: { includeArchived?: boolean } = {}): Counter[] {
      return db.select().from(activityCounters).where(opts.includeArchived ? undefined : eq(activityCounters.isArchived, false)).orderBy(asc(activityCounters.sortOrder), asc(activityCounters.name)).all();
    },

    listWithToday(date: string = localDay()): CounterToday[] {
      return this.list().map((c) => ({ ...c, today: dayTotal(c.id, date) }));
    },

    create(input: CounterInput, now: number = Date.now()): Counter {
      const d = counterSchema.parse(input);
      const dupe = db.select({ id: activityCounters.id }).from(activityCounters).where(sql`lower(${activityCounters.name}) = lower(${d.name})`).get();
      if (dupe) throw new DataError(`A counter named "${d.name}" already exists`, 'conflict');
      const order = (db.select({ m: sql<number>`coalesce(max(${activityCounters.sortOrder}), 0)` }).from(activityCounters).get()?.m ?? 0) + 1;
      const id = newId();
      db.insert(activityCounters).values({ id, name: d.name, unit: d.unit, step: d.step, dailyTarget: d.dailyTarget ?? null, sortOrder: order, createdAt: now, updatedAt: now }).run();
      return getCounter(id);
    },

    update(id: string, patch: Partial<CounterInput>, now: number = Date.now()): Counter {
      const c = getCounter(id);
      const d = counterSchema.parse({ name: c.name, unit: c.unit, step: c.step, dailyTarget: c.dailyTarget, ...patch });
      db.update(activityCounters).set({ name: d.name, unit: d.unit, step: d.step, dailyTarget: d.dailyTarget ?? null, updatedAt: now }).where(eq(activityCounters.id, id)).run();
      return getCounter(id);
    },

    /**
     * Adds `delta` (negative to decrement) to a day. A decrement can never take the day's total
     * below zero: it is clamped so history never contains negative counts.
     */
    add(id: string, delta: number, opts: { date?: string; now?: number } = {}): { total: number; applied: number } {
      getCounter(id);
      if (!Number.isFinite(delta) || delta === 0) throw new DataError('Enter a non-zero amount');
      const date = opts.date ?? localDay(opts.now);
      const current = dayTotal(id, date);
      const applied = Math.max(delta, -current);
      if (applied !== 0) {
        db.insert(counterEntries).values({ id: newId(), counterId: id, date, delta: applied, recordedAt: opts.now ?? Date.now() }).run();
      }
      return { total: current + applied, applied };
    },

    /** Reset writes one compensating entry; the earlier entries stay, so the reset itself can be undone. */
    reset(id: string, opts: { date?: string; now?: number } = {}): { cleared: number } {
      const date = opts.date ?? localDay(opts.now);
      const current = dayTotal(id, date);
      if (current !== 0) db.insert(counterEntries).values({ id: newId(), counterId: id, date, delta: -current, recordedAt: opts.now ?? Date.now() }).run();
      return { cleared: current };
    },

    /** Reverses the most recent entry of the day, whatever it was (increment, decrement or reset). */
    undoLast(id: string, date: string = localDay()): number {
      const last = db.select().from(counterEntries).where(and(eq(counterEntries.counterId, id), eq(counterEntries.date, date))).orderBy(desc(sql`rowid`)).limit(1).get(); // insertion order: timestamps can tie within a millisecond
      if (!last) throw new DataError('Nothing to undo', 'not_found');
      db.delete(counterEntries).where(eq(counterEntries.id, last.id)).run();
      return dayTotal(id, date);
    },

    /** Daily totals for a counter across [from, to], with zeros for empty days. */
    series(id: string, from: string, to: string): { date: string; total: number }[] {
      const rows = db.select({ date: counterEntries.date, t: sql<number>`sum(${counterEntries.delta})` }).from(counterEntries)
        .where(and(eq(counterEntries.counterId, id), gte(counterEntries.date, from), lte(counterEntries.date, to))).groupBy(counterEntries.date).all();
      const m = new Map(rows.map((r) => [r.date, r.t]));
      return dayRange(from, to).map((date) => ({ date, total: m.get(date) ?? 0 }));
    },

    /** Weekly (Mon-Sun, ending today) and rolling-30-day statistics. */
    stats(id: string, today: string = localDay()) {
      const week = this.series(id, startOfWeek(today), today);
      const month = this.series(id, addDays(today, -29), today);
      const sum = (a: { total: number }[]) => a.reduce((s, x) => s + x.total, 0);
      const target = getCounter(id).dailyTarget;
      const daysHit = target ? month.filter((d) => d.total >= target).length : null;
      return {
        weekTotal: sum(week), weekDailyAverage: sum(week) / week.length,
        monthTotal: sum(month), monthDailyAverage: sum(month) / 30,
        best: month.reduce((b, d) => Math.max(b, d.total), 0), daysTargetHit: daysHit,
      };
    },

    /** Built-ins can be hidden; custom counters can be deleted with all their history. */
    archive(id: string, archived = true): void {
      getCounter(id);
      db.update(activityCounters).set({ isArchived: archived, updatedAt: Date.now() }).where(eq(activityCounters.id, id)).run();
    },
    remove(id: string): void {
      const c = getCounter(id);
      if (c.isBuiltIn) throw new DataError('Built-in counters can be hidden but not deleted', 'invalid');
      db.delete(activityCounters).where(eq(activityCounters.id, id)).run();
    },
  };
}

/** Steps and water intake per day. Steps are typed in or come from the device pedometer, and the source is stored. */
export function dailyActivityRepo(db: AppDb) {
  return {
    get(date: string = localDay()) {
      return db.select().from(dailyActivity).where(eq(dailyActivity.date, date)).get() ?? { date, steps: 0, stepsSource: 'manual', caloriesEstimate: null, waterMl: 0, updatedAt: 0 };
    },
    setSteps(date: string, steps: number, source: 'manual' | 'pedometer' | 'health_connect', now: number = Date.now()): void {
      if (!Number.isInteger(steps) || steps < 0 || steps > 200_000) throw new DataError('Steps must be a whole number between 0 and 200,000');
      db.insert(dailyActivity).values({ date, steps, stepsSource: source, updatedAt: now })
        .onConflictDoUpdate({ target: dailyActivity.date, set: { steps, stepsSource: source, updatedAt: now } }).run();
    },
    addWater(date: string, deltaMl: number, now: number = Date.now()): number {
      const cur = this.get(date).waterMl;
      const next = Math.max(0, cur + deltaMl);
      db.insert(dailyActivity).values({ date, waterMl: next, updatedAt: now })
        .onConflictDoUpdate({ target: dailyActivity.date, set: { waterMl: next, updatedAt: now } }).run();
      return next;
    },
    range(from: string, to: string) {
      const rows = db.select().from(dailyActivity).where(and(gte(dailyActivity.date, from), lte(dailyActivity.date, to))).all();
      const m = new Map(rows.map((r) => [r.date, r]));
      return dayRange(from, to).map((date) => m.get(date) ?? { date, steps: 0, stepsSource: 'manual', caloriesEstimate: null, waterMl: 0, updatedAt: 0 });
    },
  };
}
