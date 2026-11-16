import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { gpsRoutePoints, runningSessions, runningSplits, userProfiles } from '../schema';
import { RUN_ACTIVITIES } from '@/constants/activities';
import { caloriesFromMet } from '@/services/calculations';
import { computeSplits, paceSecPerKm, speedMps, summariseTrack, fastestFullSplit, type GeoPoint, type PauseInterval } from '@/services/running';
import { manualRunSchema, type ManualRunInput } from '@/types/schemas';
import { newId } from '@/utils/id';
import { localDay } from '@/utils/dates';
import { DataError } from './errors';
import { recordsRepo, type RecordChange } from './records';
import type { AppDb } from '@/types/db';

export type RunningSession = typeof runningSessions.$inferSelect;

const met = (type: string) => RUN_ACTIVITIES.find((a) => a.id === type)?.met ?? 6;

export function runningRepo(db: AppDb) {
  const records = recordsRepo(db);
  const weight = () => db.select({ w: userProfiles.weightKg }).from(userProfiles).limit(1).get()?.w ?? null;
  const get = (id: string) => {
    const r = db.select().from(runningSessions).where(eq(runningSessions.id, id)).get();
    if (!r) throw new DataError('Activity not found', 'not_found');
    return r;
  };

  return {
    getActive(): RunningSession | null {
      return db.select().from(runningSessions).where(eq(runningSessions.status, 'in_progress')).orderBy(desc(runningSessions.startedAt)).limit(1).get() ?? null;
    },

    /** Manual entry: stores exactly what the user typed, labelled source='manual'. No route is invented. */
    createManual(input: ManualRunInput): { session: RunningSession; newRecords: RecordChange[] } {
      const d = manualRunSchema.parse(input);
      const dupe = db.select({ id: runningSessions.id }).from(runningSessions)
        .where(and(eq(runningSessions.startedAt, d.startedAt), eq(runningSessions.durationSec, d.durationSec), eq(runningSessions.distanceM, d.distanceM))).get();
      if (dupe) throw new DataError('This activity has already been logged', 'conflict');
      const w = weight();
      const id = newId();
      db.insert(runningSessions).values({
        id, activityType: d.activityType, date: d.date, startedAt: d.startedAt, endedAt: d.startedAt + d.durationSec * 1000,
        durationSec: d.durationSec, movingTimeSec: d.durationSec, distanceM: d.distanceM,
        avgPaceSecPerKm: paceSecPerKm(d.distanceM, d.durationSec), avgSpeedMps: speedMps(d.distanceM, d.durationSec),
        elevationGainM: d.elevationGainM ?? null, steps: d.steps ?? null,
        caloriesEstimate: w ? caloriesFromMet(met(d.activityType), w, d.durationSec) : null,
        source: 'manual', status: 'completed', notes: d.notes ?? null, createdAt: Date.now(),
      }).run();
      return { session: get(id), newRecords: records.rebuild() };
    },

    /** Begins a GPS session. The row exists immediately so a crash never loses the route recorded so far. */
    startTracking(activityType: string, now: number = Date.now()): RunningSession {
      if (this.getActive()) throw new DataError('A tracked activity is already in progress', 'conflict');
      if (!RUN_ACTIVITIES.some((a) => a.id === activityType)) throw new DataError('Unknown activity type');
      const id = newId();
      db.insert(runningSessions).values({ id, activityType, date: localDay(now), startedAt: now, source: 'gps', status: 'in_progress', createdAt: now }).run();
      return get(id);
    },

    /** Appends GPS fixes. Sequence numbers continue from the last stored point. */
    appendPoints(sessionId: string, points: GeoPoint[]): void {
      if (!points.length) return;
      get(sessionId);
      db.transaction((tx) => {
        const last = tx.select({ seq: gpsRoutePoints.seq }).from(gpsRoutePoints).where(eq(gpsRoutePoints.sessionId, sessionId)).orderBy(desc(gpsRoutePoints.seq)).limit(1).get();
        let seq = (last?.seq ?? 0) + 1;
        for (const p of points) {
          tx.insert(gpsRoutePoints).values({
            sessionId, seq: seq++, latitude: p.latitude, longitude: p.longitude, altitudeM: p.altitudeM ?? null,
            accuracyM: p.accuracyM ?? null, recordedAt: p.recordedAt,
          }).run();
        }
      });
    },

    routePoints(sessionId: string): GeoPoint[] {
      return db.select().from(gpsRoutePoints).where(eq(gpsRoutePoints.sessionId, sessionId)).orderBy(asc(gpsRoutePoints.seq)).all()
        .map((p) => ({ latitude: p.latitude, longitude: p.longitude, altitudeM: p.altitudeM, accuracyM: p.accuracyM, recordedAt: p.recordedAt }));
    },

    /**
     * Completes a GPS session. Distance, elevation, splits and pace are all derived from the stored
     * points, never from live UI counters, so the saved numbers are reproducible.
     */
    finishTracking(sessionId: string, opts: { endedAt?: number; pauses?: PauseInterval[]; steps?: number | null; notes?: string | null } = {}): { session: RunningSession; newRecords: RecordChange[] } {
      const s = get(sessionId);
      if (s.status === 'completed') throw new DataError('Activity is already finished', 'conflict');
      const endedAt = opts.endedAt ?? Date.now();
      const pauses = opts.pauses ?? [];
      const points = this.routePoints(sessionId);
      const sum = summariseTrack(points, s.startedAt, pauses);
      const totalPausedMs = pauses.reduce((a, p) => a + Math.max(0, Math.min(p.to, endedAt) - p.from), 0);
      const movingSec = Math.max(0, Math.round((endedAt - s.startedAt - totalPausedMs) / 1000));
      const splits = computeSplits(sum.samples);
      const fastest = fastestFullSplit(splits);
      const w = weight();
      db.transaction((tx) => {
        tx.delete(runningSplits).where(eq(runningSplits.sessionId, sessionId)).run();
        for (const sp of splits) tx.insert(runningSplits).values({ id: newId(), sessionId, ...sp }).run();
        tx.update(runningSessions).set({
          status: 'completed', endedAt, durationSec: Math.round((endedAt - s.startedAt) / 1000), movingTimeSec: movingSec,
          distanceM: sum.distanceM, avgPaceSecPerKm: paceSecPerKm(sum.distanceM, movingSec), avgSpeedMps: speedMps(sum.distanceM, movingSec),
          fastestPaceSecPerKm: fastest?.paceSecPerKm ?? null, elevationGainM: points.some((p) => p.altitudeM != null) ? sum.elevationGainM : null,
          steps: opts.steps ?? null, caloriesEstimate: w ? caloriesFromMet(met(s.activityType), w, movingSec) : null,
          ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
        }).where(eq(runningSessions.id, sessionId)).run();
      });
      return { session: get(sessionId), newRecords: records.rebuild() };
    },

    detail(id: string) {
      const session = get(id);
      return {
        session,
        splits: db.select().from(runningSplits).where(eq(runningSplits.sessionId, id)).orderBy(asc(runningSplits.splitIndex)).all(),
        route: this.routePoints(id),
      };
    },

    list(opts: { from?: string; to?: string; limit?: number; offset?: number } = {}): RunningSession[] {
      const conds = [eq(runningSessions.status, 'completed')];
      if (opts.from) conds.push(gte(runningSessions.date, opts.from));
      if (opts.to) conds.push(lte(runningSessions.date, opts.to));
      return db.select().from(runningSessions).where(and(...conds)).orderBy(desc(runningSessions.startedAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0).all();
    },

    /** Deletes a session; route points and splits cascade. Also used to discard an unfinished one. */
    remove(id: string): void {
      const s = get(id);
      db.delete(runningSessions).where(eq(runningSessions.id, id)).run();
      if (s.status === 'completed') records.rebuild();
    },
  };
}
