import { asc, eq } from 'drizzle-orm';
import { reminders } from '../schema';
import { reminderSchema, type ReminderInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { DataError } from './errors';
import type { AppDb } from '@/types/db';

export type Reminder = Omit<typeof reminders.$inferSelect, 'daysOfWeek' | 'notificationIds'> & { daysOfWeek: number[]; notificationIds: string[] };

const parseArr = <T>(s: string, ok: (v: unknown) => v is T): T[] => {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter(ok) : [];
  } catch {
    return [];
  }
};
const isNum = (v: unknown): v is number => typeof v === 'number';
const isStr = (v: unknown): v is string => typeof v === 'string';

const hydrate = (r: typeof reminders.$inferSelect): Reminder => ({ ...r, daysOfWeek: parseArr(r.daysOfWeek, isNum), notificationIds: parseArr(r.notificationIds, isStr) });

/** Persistence only. Actually scheduling OS notifications is done by services/notifications. */
export function remindersRepo(db: AppDb) {
  const get = (id: string): Reminder => {
    const r = db.select().from(reminders).where(eq(reminders.id, id)).get();
    if (!r) throw new DataError('Reminder not found', 'not_found');
    return hydrate(r);
  };
  return {
    list(): Reminder[] {
      return db.select().from(reminders).orderBy(asc(reminders.kind), asc(reminders.hour), asc(reminders.minute)).all().map(hydrate);
    },
    get,
    create(input: ReminderInput): Reminder {
      const d = reminderSchema.parse(input);
      const id = newId();
      db.insert(reminders).values({ id, kind: d.kind, title: d.title, body: d.body ?? null, hour: d.hour, minute: d.minute, daysOfWeek: JSON.stringify([...new Set(d.daysOfWeek)].sort()), enabled: true }).run();
      return get(id);
    },
    update(id: string, patch: Partial<ReminderInput>): Reminder {
      const cur = get(id);
      const d = reminderSchema.parse({ kind: cur.kind, title: cur.title, body: cur.body, hour: cur.hour, minute: cur.minute, daysOfWeek: cur.daysOfWeek, ...patch });
      db.update(reminders).set({ kind: d.kind, title: d.title, body: d.body ?? null, hour: d.hour, minute: d.minute, daysOfWeek: JSON.stringify([...new Set(d.daysOfWeek)].sort()) }).where(eq(reminders.id, id)).run();
      return get(id);
    },
    setEnabled(id: string, enabled: boolean): Reminder {
      get(id);
      db.update(reminders).set({ enabled }).where(eq(reminders.id, id)).run();
      return get(id);
    },
    setNotificationIds(id: string, ids: string[]): void {
      db.update(reminders).set({ notificationIds: JSON.stringify(ids) }).where(eq(reminders.id, id)).run();
    },
    remove(id: string): void {
      get(id);
      db.delete(reminders).where(eq(reminders.id, id)).run();
    },
  };
}
