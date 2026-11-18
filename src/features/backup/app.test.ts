import { count, eq } from 'drizzle-orm';
import { createTestDb, validProfile } from '@/test/db';
import { profileRepo, settingsRepo } from '@/database/repositories/profile';
import { exercisesRepo } from '@/database/repositories/exercises';
import { workoutsRepo } from '@/database/repositories/workouts';
import { runningRepo } from '@/database/repositories/running';
import { cardioRepo } from '@/database/repositories/cardio';
import { countersRepo } from '@/database/repositories/counters';
import { measurementsRepo } from '@/database/repositories/measurements';
import { plansRepo } from '@/database/repositories/plans';
import { recordsRepo, bestFiveKFromSplits, longestStreak } from '@/database/repositories/records';
import { achievementsRepo } from '@/database/repositories/achievements';
import { goalsRepo } from '@/database/repositories/goals';
import { analyticsRepo } from '@/database/repositories/analytics';
import { dataSummary, deleteAllData, exportAll, exportCsv, importBackup, validateBackup } from './backup';
import * as schema from '@/database/schema';
import { localDay } from '@/utils/dates';
import type { AppDb } from '@/types/db';

const T0 = new Date(2026, 10, 2, 9, 0, 0).getTime();
const min = 60_000;
const ex = (db: AppDb, key: string) => db.select().from(schema.exercises).where(eq(schema.exercises.seedKey, key)).get()!;

function logWorkout(db: AppDb, start: number, sets: [number, number][], exKey = 'barbell_bench_press') {
  const w = workoutsRepo(db);
  const s = w.start({ name: 'Push', now: start });
  const weId = w.addExercise(s.id, ex(db, exKey).id, start);
  const detail = w.getDetail(s.id);
  const have = detail.exercises[0]!.sets;
  sets.forEach(([kg, reps], i) => {
    const row = have[i] ?? w.addSet(weId);
    w.updateSet(row.id, { weightKg: kg, reps }, start);
    w.toggleSetComplete(row.id, start + (i + 1) * min);
  });
  return w.finish(s.id, { now: start + 45 * min });
}

describe('workout lifecycle (scenarios 4-7)', () => {
  it('creates, completes and persists a workout with volume, PRs and history', () => {
    const { db } = createTestDb();
    profileRepo(db).create(validProfile);
    const { session, newRecords } = logWorkout(db, T0, [[20, 12], [30, 10], [40, 8]]);
    expect(session.status).toBe('completed');
    expect(session.durationSec).toBe(45 * 60);
    expect(session.totalVolumeKg).toBe(240 + 300 + 320);
    expect(session.setCount).toBe(3);
    expect(session.caloriesEstimate).toBeGreaterThan(0);
    expect(newRecords.some((r) => r.kind === 'max_weight' && r.value === 40)).toBe(true);
    expect(workoutsRepo(db).history()).toHaveLength(1);
    expect(workoutsRepo(db).getActive()).toBeNull();
  });

  it('prefills the next workout from the previous one and only reports genuinely new PRs', () => {
    const { db } = createTestDb();
    logWorkout(db, T0, [[40, 8], [40, 8]]);
    const w = workoutsRepo(db);
    const s2 = w.start({ now: T0 + 86_400_000 });
    w.addExercise(s2.id, ex(db, 'barbell_bench_press').id, T0 + 86_400_000);
    const sets = w.getDetail(s2.id).exercises[0]!.sets;
    expect(sets).toHaveLength(2);
    expect(sets[0]!.weightKg).toBe(40);
    expect(sets.every((x) => !x.isCompleted)).toBe(true);
    w.toggleSetComplete(sets[0]!.id, T0 + 86_400_000 + min);
    w.updateSet(sets[0]!.id, { weightKg: 40, reps: 8 });
    expect(w.finish(s2.id, { now: T0 + 86_400_000 + 40 * min }).newRecords).toHaveLength(0); // equal, not better
  });

  it('refuses to start a second workout, and to finish one with no completed sets', () => {
    const { db } = createTestDb();
    const w = workoutsRepo(db);
    const s = w.start();
    expect(() => w.start()).toThrow(/Finish or discard/);
    expect(() => w.finish(s.id)).toThrow(/at least one set/);
    w.remove(s.id);
    expect(w.getActive()).toBeNull();
  });

  it('supports reorder, duplicate, delete and undo of exercises and sets', () => {
    const { db } = createTestDb();
    const w = workoutsRepo(db);
    const s = w.start();
    const a = w.addExercise(s.id, ex(db, 'barbell_bench_press').id);
    const b = w.addExercise(s.id, ex(db, 'barbell_row').id);
    w.reorderExercises(s.id, [b, a]);
    expect(w.getDetail(s.id).exercises.map((e) => e.id)).toEqual([b, a]);
    expect(() => w.reorderExercises(s.id, [a])).toThrow();
    const dup = w.duplicateExercise(b);
    expect(w.getDetail(s.id).exercises.map((e) => e.id)).toEqual([b, dup, a]);
    const snap = w.removeExercise(dup);
    expect(w.getDetail(s.id).exercises).toHaveLength(2);
    w.restoreExercise(snap);
    expect(w.getDetail(s.id).exercises.map((e) => e.id)).toEqual([b, dup, a]);

    const set1 = w.getDetail(s.id).exercises[2]!.sets[0]!;
    w.updateSet(set1.id, { weightKg: 50, reps: 5 });
    const extra = w.addSet(a);
    const del = w.deleteSet(set1.id);
    expect(w.getDetail(s.id).exercises[2]!.sets.map((x) => x.setOrder)).toEqual([1]);
    w.restoreSet(del);
    const restored = w.getDetail(s.id).exercises[2]!.sets;
    expect(restored.map((x) => x.id)).toEqual([set1.id, extra.id]);
    expect(restored[0]!.weightKg).toBe(50);
  });

  it('deleting a finished workout removes its sets and recomputes records', () => {
    const { db } = createTestDb();
    const { session } = logWorkout(db, T0, [[100, 5]]);
    expect(recordsRepo(db).list().length).toBeGreaterThan(0);
    workoutsRepo(db).remove(session.id);
    expect(db.select({ n: count() }).from(schema.workoutSets).get()!.n).toBe(0);
    expect(recordsRepo(db).list()).toHaveLength(0);
  });

  it('rejects negative or non-finite set values', () => {
    const { db } = createTestDb();
    const w = workoutsRepo(db);
    const s = w.start();
    w.addExercise(s.id, ex(db, 'barbell_bench_press').id);
    const set = w.getDetail(s.id).exercises[0]!.sets[0]!;
    expect(() => w.updateSet(set.id, { weightKg: -5 })).toThrow(/Invalid/);
    expect(() => w.updateSet(set.id, { reps: NaN })).toThrow(/Invalid/);
  });
});

describe('records, achievements, analytics', () => {
  it('detects PRs across kinds and ties keep the earliest', () => {
    const { db } = createTestDb();
    logWorkout(db, T0, [[60, 5]]);
    logWorkout(db, T0 + 86_400_000, [[60, 5]]);
    const r = recordsRepo(db).list().find((x) => x.kind === 'max_weight')!;
    expect(r.value).toBe(60);
    expect(r.date).toBe(localDay(T0));
    expect(r.subjectName).toBe('Barbell Bench Press');
  });
  it('5K from splits needs five consecutive full km', () => {
    const sp = (i: number, d: number) => ({ splitIndex: i, distanceM: 1000, durationSec: d });
    expect(bestFiveKFromSplits([sp(1, 300), sp(2, 300), sp(3, 300), sp(4, 300)])).toBeNull();
    expect(bestFiveKFromSplits([sp(1, 400), sp(2, 300), sp(3, 300), sp(4, 300), sp(5, 300), sp(6, 300)])).toBe(1500);
  });
  it('streaks count consecutive days only', () => {
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05']).length).toBe(3);
    expect(longestStreak([]).length).toBe(0);
  });
  it('achievements unlock from data and lock again if the data is deleted', () => {
    const { db } = createTestDb();
    expect(achievementsRepo(db).evaluate()).toHaveLength(0);
    const { session } = logWorkout(db, T0, [[50, 5]]);
    const fresh = achievementsRepo(db).evaluate().map((a) => a.key);
    expect(fresh).toContain('first_workout');
    expect(fresh).toContain('first_pr');
    expect(achievementsRepo(db).evaluate()).toHaveLength(0);
    workoutsRepo(db).remove(session.id);
    achievementsRepo(db).evaluate();
    expect(achievementsRepo(db).list().filter((a) => a.unlockedAt)).toHaveLength(0);
  });
  it('analytics range bounds and muscle distribution', () => {
    const { db } = createTestDb();
    logWorkout(db, T0, [[50, 5], [50, 5]]);
    const a = analyticsRepo(db);
    const stats = a.workoutStats('all', '2026-11-30');
    expect(stats.totalWorkouts).toBe(1);
    expect(stats.muscleDistribution[0]).toMatchObject({ groupId: 'chest', sets: 2, share: 1 });
    expect(a.workoutStats('7d', '2026-12-30').totalWorkouts).toBe(0);
    expect(a.exerciseProgression(ex(db, 'barbell_bench_press').id, 'all', '2026-11-30')[0]!.topWeightKg).toBe(50);
  });
});

describe('running, cardio, counters, measurements, plans, goals', () => {
  it('logs a manual run honestly, computes pace, rejects duplicates and bad input', () => {
    const { db } = createTestDb();
    const r = runningRepo(db);
    const input = { activityType: 'outdoor_run' as const, date: '2026-11-02', startedAt: T0, durationSec: 1500, distanceM: 5000 };
    const { session, newRecords } = r.createManual(input);
    expect(session.source).toBe('manual');
    expect(session.avgPaceSecPerKm).toBe(300);
    expect(newRecords.map((n) => n.kind)).toEqual(expect.arrayContaining(['longest_run', 'fastest_5k']));
    expect(r.detail(session.id).route).toHaveLength(0);
    expect(() => r.createManual(input)).toThrow(/already been logged/);
    expect(() => r.createManual({ ...input, startedAt: T0 + 1, distanceM: -1 })).toThrow();
  });
  it('tracks a GPS session, persists points, derives distance and splits on finish', () => {
    const { db } = createTestDb();
    const r = runningRepo(db);
    const s = r.startTracking('outdoor_run', T0);
    expect(() => r.startTracking('outdoor_run')).toThrow(/already in progress/);
    const pts = Array.from({ length: 31 }, (_, i) => ({ latitude: i * 0.0001, longitude: 0, recordedAt: T0 + i * 3000, accuracyM: 5 }));
    r.appendPoints(s.id, pts.slice(0, 15));
    r.appendPoints(s.id, pts.slice(15));
    expect(r.routePoints(s.id)).toHaveLength(31);
    const { session } = r.finishTracking(s.id, { endedAt: T0 + 90_000 });
    expect(session.source).toBe('gps');
    expect(session.distanceM).toBeGreaterThan(300);
    expect(session.distanceM).toBeLessThan(400);
    expect(session.avgPaceSecPerKm).toBeGreaterThan(200);
    r.remove(s.id);
    expect(db.select({ n: count() }).from(schema.gpsRoutePoints).get()!.n).toBe(0);
  });
  it('cardio estimates calories from MET only with a known bodyweight', () => {
    const { db } = createTestDb();
    const c = cardioRepo(db);
    const base = { activityType: 'cycling', date: '2026-11-02', startedAt: T0, durationSec: 3600 };
    expect(c.create(base).caloriesEstimate).toBeNull();
    profileRepo(db).create(validProfile);
    expect(c.create({ ...base, startedAt: T0 + 1 }).caloriesEstimate).toBe(600);
    expect(() => c.create({ ...base, startedAt: T0 + 2, activityType: 'custom' })).toThrow(/Name your/);
    expect(() => c.create({ ...base, startedAt: T0 + 3, avgHeartRate: 150, maxHeartRate: 120 })).toThrow(/Max heart rate/);
  });
  it('counters: increment, clamp decrement, reset, undo, stats, custom create', () => {
    const { db } = createTestDb();
    const c = countersRepo(db);
    const push = c.list().find((x) => x.builtInKey === 'pushups')!;
    expect(c.add(push.id, 10, { date: '2026-11-02' }).total).toBe(10);
    expect(c.add(push.id, -25, { date: '2026-11-02' })).toEqual({ total: 0, applied: -10 });
    c.add(push.id, 20, { date: '2026-11-02', now: 1 });
    expect(c.reset(push.id, { date: '2026-11-02', now: 2 }).cleared).toBe(20);
    expect(c.undoLast(push.id, '2026-11-02')).toBe(20);
    c.add(push.id, 60, { date: '2026-11-03' });
    const st = c.stats(push.id, '2026-11-03');
    expect(st.monthTotal).toBe(80);
    expect(st.daysTargetHit).toBe(1);
    const custom = c.create({ name: 'Burpees', unit: 'reps', step: 5, dailyTarget: 50 });
    expect(() => c.create({ name: 'burpees', unit: 'reps', step: 1 })).toThrow(/already exists/);
    expect(() => c.remove(push.id)).toThrow(/Built-in/);
    c.remove(custom.id);
    expect(() => c.add('nope', 1)).toThrow(/not found/);
  });
  it('measurements update profile weight to the newest weigh-in and validate input', () => {
    const { db } = createTestDb();
    profileRepo(db).create(validProfile);
    const m = measurementsRepo(db);
    m.create({ date: '2026-11-01', weightKg: 79 });
    m.create({ date: '2026-10-01', weightKg: 85 }); // older: must not override
    expect(profileRepo(db).get()!.weightKg).toBe(79);
    expect(m.currentBmi()).toBeCloseTo(79 / 1.78 ** 2, 2);
    expect(() => m.create({ date: '2026-11-02' })).toThrow(/at least one/);
    expect(() => m.create({ date: '2026-11-02', weightKg: -1 })).toThrow();
    expect(analyticsRepo(db).weightChange().monthly).toBeCloseTo(-6, 5);
  });
  it('plans: template, duplicate, activate, start a workout from a plan day, calendar missed/completed', () => {
    const { db } = createTestDb();
    const p = plansRepo(db);
    const plan = p.createFromTemplate('ppl', T0 - 14 * 86_400_000);
    const full = p.get(plan.id);
    expect(full.items.length).toBeGreaterThan(20);
    const dup = p.duplicate(plan.id);
    expect(dup.name).toBe('Push Pull Legs (copy)');
    expect(p.get(dup.id).items).toHaveLength(full.items.length);
    p.setActive(plan.id);
    p.setActive(dup.id);
    expect(p.getActive()!.id).toBe(dup.id);
    p.setActive(plan.id);
    const w = workoutsRepo(db).start({ planId: plan.id, dayOfWeek: 1, name: 'Push A', now: T0 });
    const detail = workoutsRepo(db).getDetail(w.id);
    expect(detail.exercises).toHaveLength(5);
    expect(detail.exercises[0]!.sets).toHaveLength(4);
    expect(detail.exercises[0]!.sets[0]!.reps).toBe(6);
    const cal = p.calendar('2026-11-02', '2026-11-08', '2026-11-08');
    expect(cal.find((d) => d.date === '2026-11-03')!.status).toBe('missed'); // Tue, nothing logged
    expect(cal.find((d) => d.date === '2026-11-08')!.status).toBe('rest'); // Sunday, no plan
    p.remove(plan.id);
    expect(workoutsRepo(db).getDetail(w.id).planId).toBeNull();
  });
  it('goals track real progress and complete weight goals once', () => {
    const { db } = createTestDb();
    profileRepo(db).create(validProfile);
    const g = goalsRepo(db);
    g.create({ type: 'weight', title: 'Reach 75', targetValue: 75 });
    measurementsRepo(db).create({ date: '2026-11-02', weightKg: 77.5 });
    expect(g.list({ status: 'active' })[0]!.progress).toBeCloseTo(0.5, 5);
    measurementsRepo(db).create({ date: '2026-11-09', weightKg: 74.9 });
    expect(g.list()[0]!.status).toBe('completed');
    expect(g.list({ status: 'active' })).toHaveLength(0);
    expect(() => g.create({ type: 'weight', title: 'x', targetValue: 0 })).toThrow();
  });
});

describe('backup, import/export, delete (scenarios 11-14)', () => {
  function populated() {
    const t = createTestDb();
    const { db } = t;
    profileRepo(db).create(validProfile);
    logWorkout(db, T0, [[60, 5], [60, 5]]);
    runningRepo(db).createManual({ activityType: 'outdoor_run', date: '2026-11-02', startedAt: T0, durationSec: 1500, distanceM: 5000 });
    cardioRepo(db).create({ activityType: 'rowing', date: '2026-11-03', startedAt: T0, durationSec: 1200 });
    measurementsRepo(db).create({ date: '2026-11-02', weightKg: 80, notes: 'a "quoted", note' });
    const c = countersRepo(db);
    c.add(c.list()[0]!.id, 12, { date: '2026-11-02' });
    c.create({ name: 'Burpees', unit: 'reps', step: 1 });
    exercisesRepo(db).createCustom({ name: 'Zercher Squat', muscleGroupId: 'quadriceps', secondaryMuscles: [], equipment: 'barbell', difficulty: 'advanced', trackingType: 'weight_reps' });
    settingsRepo(db).set('theme', 'dark');
    settingsRepo(db).set('security.pinHash', 'SECRET');
    return t;
  }

  it('round-trips everything into a fresh database', () => {
    const src = populated().db;
    const file = JSON.parse(JSON.stringify(exportAll(src)));
    expect(validateBackup(file).ok).toBe(true);
    const dest = createTestDb().db;
    const res = importBackup(dest, file);
    expect(res.totalInserted).toBeGreaterThan(10);
    expect(profileRepo(dest).get()!.fullName).toBe('Test User');
    expect(workoutsRepo(dest).history()).toHaveLength(1);
    expect(workoutsRepo(dest).history()[0]!.totalVolumeKg).toBe(600);
    expect(runningRepo(dest).list()).toHaveLength(1);
    expect(measurementsRepo(dest).list()[0]!.notes).toBe('a "quoted", note');
    expect(exercisesRepo(dest).list({ customOnly: true })).toHaveLength(1);
    expect(settingsRepo(dest).get('theme', '')).toBe('dark');
    expect(recordsRepo(dest).list().some((r) => r.kind === 'max_weight')).toBe(true);
  });

  it('never exports security settings', () => {
    const file = exportAll(populated().db);
    expect(JSON.stringify(file)).not.toContain('SECRET');
  });

  it('detects duplicates on a second import instead of duplicating rows', () => {
    const src = populated().db;
    const file = JSON.parse(JSON.stringify(exportAll(src)));
    const dest = createTestDb().db;
    importBackup(dest, file);
    const again = importBackup(dest, file);
    expect(again.totalInserted).toBe(0);
    expect(again.totalDuplicates).toBeGreaterThan(10);
    expect(workoutsRepo(dest).history()).toHaveLength(1);
  });

  it('is atomic: a bad row rolls back the whole import', () => {
    const src = populated().db;
    const file = JSON.parse(JSON.stringify(exportAll(src)));
    file.tables.workoutSets[0].workoutExerciseId = 'does-not-exist';
    const dest = createTestDb().db;
    expect(() => importBackup(dest, file)).toThrow();
    expect(profileRepo(dest).get()).toBeNull();
    expect(dataSummary(dest).workouts).toBe(0);
  });

  it('validation rejects wrong app, newer format, unknown fields and wrong types', () => {
    expect(validateBackup({ hello: 1 }).ok).toBe(false);
    expect(validateBackup({ app: 'other', formatVersion: 1, exportedAt: 1, tables: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'fittrack', formatVersion: 99, exportedAt: 1, tables: {} }).errors[0]).toMatch(/newer version/);
    const file = JSON.parse(JSON.stringify(exportAll(populated().db)));
    file.tables.workoutSessions[0].durationSec = 'long';
    file.tables.workoutSessions[0].bogus = 1;
    const v = validateBackup(file);
    expect(v.ok).toBe(false);
    expect(v.errors.join()).toMatch(/bogus/);
    expect(v.errors.join()).toMatch(/durationSec/);
    expect(validateBackup('not json').ok).toBe(false);
  });

  it('replace mode swaps existing data for the backup', () => {
    const file = JSON.parse(JSON.stringify(exportAll(populated().db)));
    const dest = createTestDb().db;
    profileRepo(dest).create({ ...validProfile, fullName: 'Someone Else' });
    runningRepo(dest).createManual({ activityType: 'walk', date: '2026-10-01', startedAt: T0 - 1e9, durationSec: 600, distanceM: 800 });
    importBackup(dest, file, 'replace');
    expect(profileRepo(dest).get()!.fullName).toBe('Test User');
    expect(runningRepo(dest).list()).toHaveLength(1);
    expect(runningRepo(dest).list()[0]!.distanceM).toBe(5000);
  });

  it('exports CSVs with set-level workout rows', () => {
    const files = exportCsv(populated().db, '2026-11-16');
    expect(files.map((f) => f.filename)).toContain('fittrack-workouts-2026-11-16.csv');
    const w = files[0]!.content.split('\r\n');
    expect(w[0]).toContain('exercise');
    expect(w).toHaveLength(2 + 1 + 1); // header + 2 sets + trailing empty
    expect(w[1]).toContain('Barbell Bench Press');
    expect(files.find((f) => f.filename.includes('measurements'))!.content).toContain('"a ""quoted"", note"');
  });

  it('delete selected records, clear history, delete profile, and delete everything', () => {
    const { db } = populated();
    const before = dataSummary(db);
    expect(before.workouts).toBe(1);
    const sess = workoutsRepo(db).history()[0]!;
    workoutsRepo(db).remove(sess.id);
    runningRepo(db).remove(runningRepo(db).list()[0]!.id);
    cardioRepo(db).remove(cardioRepo(db).list()[0]!.id);
    measurementsRepo(db).remove(measurementsRepo(db).list()[0]!.id);
    expect(dataSummary(db)).toMatchObject({ workouts: 0, runs: 0, cardio: 0, measurements: 0, hasProfile: true });
    profileRepo(db).remove();
    expect(profileRepo(db).get()).toBeNull();

    const full = populated().db;
    workoutsRepo(full).clearHistory();
    expect(dataSummary(full).workouts).toBe(0);
    deleteAllData(full);
    expect(dataSummary(full)).toMatchObject({ workouts: 0, runs: 0, cardio: 0, measurements: 0, plans: 0, counterEntries: 0, hasProfile: false });
    expect(exercisesRepo(full).list({ customOnly: true })).toHaveLength(0);
    expect(exercisesRepo(full).list().length).toBeGreaterThan(100); // built-ins restored
    expect(countersRepo(full).list().every((x) => x.isBuiltIn)).toBe(true);
    expect(settingsRepo(full).all()).toEqual({});
  });
});

describe('repeat workout and streaks', () => {
  it('repeats a past workout with the same sets, unchecked, and refuses while one is in progress', () => {
    const { db } = createTestDb();
    profileRepo(db).create(validProfile);
    const { session } = logWorkout(db, T0, [[20, 12], [30, 10]]);
    const w = workoutsRepo(db);
    const copy = w.repeat(session.id, T0 + 1000 * min);
    const d = w.getDetail(copy.id);
    expect(copy.status).toBe('in_progress');
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0]!.sets.map((s) => [s.weightKg, s.reps, s.isCompleted])).toEqual([[20, 12, false], [30, 10, false]]);
    expect(() => w.repeat(session.id)).toThrow(/current workout/);
  });

  it('counts a streak that is still alive if you trained yesterday, and this week\'s workouts', () => {
    const { db } = createTestDb();
    profileRepo(db).create(validProfile);
    const day = 24 * 60 * min;
    logWorkout(db, T0, [[20, 10]]);            // Mon 2 Nov
    logWorkout(db, T0 + day, [[20, 10]]);      // Tue 3 Nov
    const a = analyticsRepo(db);
    expect(a.streaks('2026-11-04').current).toBe(2); // not trained Wed yet: streak alive
    expect(a.streaks('2026-11-05').current).toBe(0); // missed a full day: broken
    expect(a.streaks('2026-11-04').best).toBe(2);
    expect(a.streaks('2026-11-04').weekWorkouts).toBe(2);
    expect(a.streaks('2026-11-04').weekDays).toHaveLength(7);
  });
});
