/** @jest-environment node */
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { createTestDb, validProfile } from '@/test/db';
import { profileRepo } from '@/database/repositories/profile';
import { workoutsRepo } from '@/database/repositories/workouts';
import { measurementsRepo } from '@/database/repositories/measurements';
import { syncWithServer } from './sync';
import * as schema from '@/database/schema';
import type { AppDb } from '@/types/db';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mergeEnvelopes, emptyEnvelope } = require('../../../scripts/sync-merge.js') as { mergeEnvelopes: (a: unknown, b: unknown) => { merged: { tables: Record<string, unknown[]> }; added: number }; emptyEnvelope: () => unknown };

const T0 = new Date(2026, 10, 2, 9, 0, 0).getTime();
const ex = (db: AppDb) => db.select().from(schema.exercises).where(eq(schema.exercises.seedKey, 'barbell_bench_press')).get()!;
function logWorkout(db: AppDb, start: number) {
  const w = workoutsRepo(db);
  const s = w.start({ name: 'Push', now: start });
  w.addExercise(s.id, ex(db).id, start);
  const set = w.getDetail(s.id).exercises[0]!.sets[0]!;
  w.updateSet(set.id, { weightKg: 50, reps: 5 }, start);
  w.toggleSetComplete(set.id, start + 60_000);
  w.finish(s.id, { now: start + 45 * 60_000 });
}

describe('merge rules', () => {
  const env = (tables: Record<string, unknown[]>) => ({ app: 'fittrack', formatVersion: 1, exportedAt: 1, tables });
  it('unions by key, is idempotent, keeps the first row, and keeps only one profile', () => {
    const a = env({ workoutSessions: [{ id: 'w1', name: 'A' }], userProfiles: [{ id: 'p1' }], dailyActivity: [{ date: '2026-11-02', steps: 10 }] });
    const b = env({ workoutSessions: [{ id: 'w1', name: 'B' }, { id: 'w2' }], userProfiles: [{ id: 'p2' }], dailyActivity: [{ date: '2026-11-02', steps: 99 }, { date: '2026-11-03', steps: 5 }] });
    const m1 = mergeEnvelopes(emptyEnvelope(), a).merged;
    const { merged, added } = mergeEnvelopes(m1, b);
    expect(added).toBe(2);
    expect(merged.tables.workoutSessions).toEqual([{ id: 'w1', name: 'A' }, { id: 'w2' }]);
    expect(merged.tables.userProfiles).toEqual([{ id: 'p1' }]);
    expect((merged.tables.dailyActivity as { steps: number }[]).map((d) => d.steps)).toEqual([10, 5]);
    expect(mergeEnvelopes(merged, b).added).toBe(0);
    expect(() => mergeEnvelopes(emptyEnvelope(), { nope: true })).toThrow();
  });
});

describe('two devices syncing through the real server', () => {
  let server: ChildProcess; let url: string; let code: string; let dir: string;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-sync-'));
    server = spawn('node', [path.join(__dirname, '../../../scripts/sync-server.js')], { env: { ...process.env, SYNC_DATA_DIR: dir, PORT: '18787' } });
    await new Promise<void>((res, rej) => { server.stdout!.on('data', (d: Buffer) => { if (String(d).includes('Pairing code')) res(); }); server.on('error', rej); setTimeout(() => rej(new Error('server did not start')), 8000); });
    url = 'http://127.0.0.1:18787'; code = fs.readFileSync(path.join(dir, 'pairing-code.txt'), 'utf8').trim();
  }, 15000);
  afterAll(() => { server.kill(); });

  it('rejects a wrong pairing code', async () => {
    const { db } = createTestDb(); profileRepo(db).create(validProfile);
    await expect(syncWithServer(db, url, '000000')).rejects.toThrow(/Wrong pairing code/);
  });

  it('shares workouts and measurements both ways, never duplicates, and a new device adopts the profile', async () => {
    const phone = createTestDb().db; const web = createTestDb().db;
    profileRepo(phone).create(validProfile);
    logWorkout(phone, T0);
    measurementsRepo(phone).create({ date: '2026-11-02', weightKg: 80 });
    expect((await syncWithServer(phone, url, code)).added).toBe(0);

    const r = await syncWithServer(web, url, code); // brand-new device
    expect(r.added).toBeGreaterThan(0);
    expect(profileRepo(web).get()?.fullName).toBe(profileRepo(phone).get()?.fullName);
    expect(workoutsRepo(web).history({}).map((w) => w.name)).toEqual(['Push']);
    expect(measurementsRepo(web).list({}).map((m) => m.weightKg)).toEqual([80]);

    logWorkout(web, T0 + 24 * 3600_000); // new work on the website
    await syncWithServer(web, url, code);
    expect((await syncWithServer(phone, url, code)).added).toBeGreaterThan(0);
    expect(workoutsRepo(phone).history({})).toHaveLength(2);
    expect((await syncWithServer(phone, url, code)).added).toBe(0); // idempotent
    expect(workoutsRepo(web).history({})).toHaveLength(2);
    expect(phone.select().from(schema.userProfiles).all()).toHaveLength(1);
  }, 30000);
});
