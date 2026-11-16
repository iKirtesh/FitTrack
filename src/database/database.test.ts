import { count, eq } from 'drizzle-orm';
import { createTestDb, validProfile } from '@/test/db';
import { seedReferenceData } from './seed';
import { exercises, muscleGroups, activityCounters, workoutSessions, workoutExercises } from './schema';
import { profileRepo, settingsRepo } from './repositories/profile';
import { exercisesRepo } from './repositories/exercises';
import { EXERCISE_SEED } from './seed-exercises';
import { MUSCLE_GROUPS } from '@/constants/exercise';

describe('database foundation', () => {
  it('applies migrations and creates every required table', () => {
    const { sqlite } = createTestDb();
    const tables = (sqlite.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]).map((t) => t.name);
    const required = [
      'user_profiles', 'exercises', 'muscle_groups', 'workout_plans', 'workout_plan_exercises', 'workout_sessions',
      'workout_exercises', 'workout_sets', 'cardio_sessions', 'running_sessions', 'running_splits', 'gps_route_points',
      'daily_activity', 'activity_counters', 'counter_entries', 'body_measurements', 'fitness_goals', 'personal_records',
      'achievements', 'reminders', 'app_settings',
    ];
    for (const t of required) expect(tables).toContain(t);
  });

  it('enforces foreign keys', () => {
    const { sqlite } = createTestDb();
    expect(() =>
      sqlite.prepare("insert into workout_exercises (id, session_id, exercise_id, position, rest_sec) values ('a','missing','missing',1,90)").run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('seed data has unique keys and valid muscle groups', () => {
    const keys = EXERCISE_SEED.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = new Set<string>(MUSCLE_GROUPS.map((m) => m.id));
    for (const e of EXERCISE_SEED) {
      expect(ids.has(e.muscle)).toBe(true);
      for (const s of e.secondary ?? []) expect(ids.has(s)).toBe(true);
    }
  });

  it('seeding is idempotent and never duplicates', () => {
    const { db } = createTestDb();
    const before = db.select({ n: count() }).from(exercises).get()!.n;
    seedReferenceData(db);
    seedReferenceData(db);
    expect(db.select({ n: count() }).from(exercises).get()!.n).toBe(before);
    expect(before).toBe(EXERCISE_SEED.length);
    expect(db.select({ n: count() }).from(muscleGroups).get()!.n).toBe(MUSCLE_GROUPS.length);
    expect(db.select({ n: count() }).from(activityCounters).get()!.n).toBeGreaterThan(0);
  });

  it('reseeding does not overwrite user edits to a seeded exercise name', () => {
    const { db } = createTestDb();
    db.update(exercises).set({ instructions: 'my own cue' }).where(eq(exercises.seedKey, 'plank')).run();
    seedReferenceData(db);
    expect(db.select().from(exercises).where(eq(exercises.seedKey, 'plank')).get()!.instructions).toBe('my own cue');
  });

  it('cascades deletes from session to sets but restricts deleting used exercises', () => {
    const { db, sqlite } = createTestDb();
    const ex = db.select().from(exercises).limit(1).get()!;
    sqlite.prepare("insert into workout_sessions (id,name,date,started_at,created_at,updated_at) values ('s','w','2026-01-01',1,1,1)").run();
    sqlite.prepare("insert into workout_exercises (id,session_id,exercise_id,position,rest_sec) values ('we','s',?,1,90)").run(ex.id);
    expect(() => db.delete(exercises).where(eq(exercises.id, ex.id)).run()).toThrow(/FOREIGN KEY/);
    db.delete(workoutSessions).where(eq(workoutSessions.id, 's')).run();
    expect(db.select({ n: count() }).from(workoutExercises).get()!.n).toBe(0);
  });
});

describe('profile repository', () => {
  it('creates, reads, updates and persists a profile', () => {
    const { db } = createTestDb();
    const repo = profileRepo(db);
    expect(repo.get()).toBeNull();
    const created = repo.create(validProfile, 1000);
    expect(created.fullName).toBe('Test User');
    expect(created.preferredWorkoutDays).toEqual([1, 3, 5]);
    expect(created.createdAt).toBe(1000);
    const updated = repo.update({ weightKg: 78.5, goal: 'weight_loss' }, 2000);
    expect(updated.weightKg).toBe(78.5);
    expect(updated.goal).toBe('weight_loss');
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBe(2000);
    expect(repo.get()!.heightCm).toBe(178);
  });

  it('rejects a second profile and invalid data', () => {
    const { db } = createTestDb();
    const repo = profileRepo(db);
    repo.create(validProfile);
    expect(() => repo.create(validProfile)).toThrow(/already exists/);
    expect(() => repo.update({ heightCm: -5 })).toThrow();
    expect(() => repo.update({ fullName: '   ' })).toThrow();
    expect(repo.get()!.heightCm).toBe(178);
  });

  it('survives corrupt preferred-days JSON', () => {
    const { db, sqlite } = createTestDb();
    profileRepo(db).create(validProfile);
    sqlite.prepare("update user_profiles set preferred_workout_days = 'not json'").run();
    expect(profileRepo(db).get()!.preferredWorkoutDays).toEqual([]);
  });

  it('settings round-trip JSON and fall back safely', () => {
    const { db } = createTestDb();
    const s = settingsRepo(db);
    expect(s.get('theme', 'system')).toBe('system');
    s.set('theme', 'dark');
    s.set('dashboard', { cards: ['a', 'b'] });
    expect(s.get('theme', 'system')).toBe('dark');
    expect(s.get<{ cards: string[] }>('dashboard', { cards: [] }).cards).toEqual(['a', 'b']);
    s.set('theme', 'light');
    expect(s.get('theme', 'system')).toBe('light');
  });
});

describe('exercises repository', () => {
  it('searches by name and filters by muscle and equipment', () => {
    const { db } = createTestDb();
    const repo = exercisesRepo(db);
    expect(repo.list({ search: 'bench' }).length).toBeGreaterThan(2);
    expect(repo.list({ search: 'BENCH' }).length).toBe(repo.list({ search: 'bench' }).length);
    expect(repo.list({ muscleGroupId: 'chest' }).every((e) => e.muscleGroupId === 'chest')).toBe(true);
    expect(repo.list({ equipment: 'kettlebell' }).every((e) => e.equipment === 'kettlebell')).toBe(true);
    expect(repo.list({ search: '100%' })).toEqual([]); // % is literal, not a wildcard
  });

  it('creates, edits and deletes custom exercises but protects built-ins and used ones', () => {
    const { db } = createTestDb();
    const repo = exercisesRepo(db);
    const c = repo.createCustom({ name: 'Zercher Squat', muscleGroupId: 'quadriceps', secondaryMuscles: [], equipment: 'barbell', difficulty: 'advanced', trackingType: 'weight_reps' });
    expect(c.isCustom).toBe(true);
    expect(() => repo.createCustom({ name: 'zercher squat', muscleGroupId: 'legs', secondaryMuscles: [], equipment: 'barbell', difficulty: 'advanced', trackingType: 'weight_reps' })).toThrow(/already have/);
    expect(repo.updateCustom(c.id, { name: 'Zercher Squat 2', muscleGroupId: 'quadriceps', secondaryMuscles: ['glutes'], equipment: 'barbell', difficulty: 'advanced', trackingType: 'weight_reps' }).secondaryMuscles).toEqual(['glutes']);
    const builtin = repo.list({ search: 'Plank' })[0]!;
    expect(() => repo.deleteCustom(builtin.id)).toThrow(/Built-in/);
    repo.deleteCustom(c.id);
    expect(repo.get(c.id)).toBeNull();
  });
});
