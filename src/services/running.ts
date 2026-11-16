export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  recordedAt: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Seconds per km, or null when distance is zero (no fabricated pace). */
export function paceSecPerKm(distanceM: number, durationSec: number): number | null {
  if (distanceM <= 0 || durationSec <= 0) return null;
  return durationSec / (distanceM / 1000);
}

export function speedMps(distanceM: number, durationSec: number): number | null {
  if (durationSec <= 0 || distanceM < 0) return null;
  return distanceM / durationSec;
}

export type AccuracyLevel = 'good' | 'fair' | 'poor' | 'unknown';
export function accuracyLevel(accuracyM: number | null | undefined): AccuracyLevel {
  if (accuracyM == null || accuracyM < 0) return 'unknown';
  if (accuracyM <= 10) return 'good';
  if (accuracyM <= 25) return 'fair';
  return 'poor';
}

/** Readings worse than this are dropped from distance so GPS drift doesn't inflate a run. */
export const MAX_ACCEPTABLE_ACCURACY_M = 30;
/** Faster than this between two fixes is treated as a GPS jump, not human movement. */
const MAX_PLAUSIBLE_SPEED_MPS = 12;

export interface TrackState {
  distanceM: number;
  elevationGainM: number;
  last: GeoPoint | null;
  accepted: number;
  rejected: number;
}

export const emptyTrack = (): TrackState => ({ distanceM: 0, elevationGainM: 0, last: null, accepted: 0, rejected: 0 });

/** Folds one GPS fix into the running totals. Pure, so it is testable without a device. */
export function addPoint(state: TrackState, p: GeoPoint): TrackState {
  if (p.accuracyM != null && p.accuracyM > MAX_ACCEPTABLE_ACCURACY_M) {
    return { ...state, rejected: state.rejected + 1 };
  }
  if (!state.last) return { ...state, last: p, accepted: state.accepted + 1 };
  const d = haversineM(state.last, p);
  const dt = (p.recordedAt - state.last.recordedAt) / 1000;
  if (dt <= 0 || d / dt > MAX_PLAUSIBLE_SPEED_MPS) return { ...state, rejected: state.rejected + 1 };
  let gain = state.elevationGainM;
  if (p.altitudeM != null && state.last.altitudeM != null) {
    const dh = p.altitudeM - state.last.altitudeM;
    // 1 m dead-band: consumer GPS altitude is noisy, small wobble is not climbing.
    if (dh > 1) gain += dh;
  }
  return { distanceM: state.distanceM + d, elevationGainM: gain, last: p, accepted: state.accepted + 1, rejected: state.rejected };
}

export interface Split {
  splitIndex: number;
  distanceM: number;
  durationSec: number;
  paceSecPerKm: number;
}

/**
 * Builds per-km (or per-mile) splits from timed distance samples.
 * `samples` are cumulative (distanceM, elapsedSec) pairs in order. Boundaries are
 * linearly interpolated; a trailing partial split is included with its real distance.
 */
export function computeSplits(
  samples: { distanceM: number; elapsedSec: number }[],
  splitLengthM = 1000,
): Split[] {
  const out: Split[] = [];
  if (samples.length < 2) return out;
  let nextBoundary = splitLengthM;
  let prevBoundaryTime = 0;
  let prevBoundaryDist = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    while (b.distanceM >= nextBoundary && b.distanceM > a.distanceM) {
      const frac = (nextBoundary - a.distanceM) / (b.distanceM - a.distanceM);
      const t = a.elapsedSec + frac * (b.elapsedSec - a.elapsedSec);
      const dur = t - prevBoundaryTime;
      out.push({
        splitIndex: out.length + 1,
        distanceM: splitLengthM,
        durationSec: dur,
        paceSecPerKm: dur / (splitLengthM / 1000),
      });
      prevBoundaryTime = t;
      prevBoundaryDist = nextBoundary;
      nextBoundary += splitLengthM;
    }
  }
  const last = samples[samples.length - 1]!;
  const rest = last.distanceM - prevBoundaryDist;
  // Only keep a trailing partial split if it is a meaningful stretch (>=100 m).
  if (rest >= 100) {
    const dur = last.elapsedSec - prevBoundaryTime;
    out.push({ splitIndex: out.length + 1, distanceM: rest, durationSec: dur, paceSecPerKm: dur / (rest / 1000) });
  }
  return out;
}

/** Fastest full kilometre, ignoring partial trailing splits. */
export function fastestFullSplit(splits: Split[], splitLengthM = 1000): Split | null {
  const full = splits.filter((s) => Math.abs(s.distanceM - splitLengthM) < 1);
  if (!full.length) return null;
  return full.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a));
}

export const FIVE_K_M = 5000;

export interface PauseInterval { from: number; to: number }

/** Milliseconds of pause that happened before time `t`. */
export function pausedBefore(t: number, pauses: PauseInterval[]): number {
  let ms = 0;
  for (const p of pauses) {
    if (t <= p.from) continue;
    ms += Math.min(t, p.to) - p.from;
  }
  return ms;
}

export interface TrackSummary {
  distanceM: number;
  elevationGainM: number;
  samples: { distanceM: number; elapsedSec: number }[];
  accepted: number;
  rejected: number;
}

/**
 * Re-derives distance, elevation and timed samples from stored route points. Deterministic, so a
 * session interrupted by an app crash can be finished later with exactly the same numbers.
 * Time spent paused is excluded from elapsed time (and therefore from pace).
 */
export function summariseTrack(points: GeoPoint[], startedAt: number, pauses: PauseInterval[] = []): TrackSummary {
  let st = emptyTrack();
  const samples: { distanceM: number; elapsedSec: number }[] = [{ distanceM: 0, elapsedSec: 0 }];
  for (const p of points) {
    const before = st.accepted;
    st = addPoint(st, p);
    if (st.accepted > before && st.distanceM > 0) {
      samples.push({ distanceM: st.distanceM, elapsedSec: (p.recordedAt - startedAt - pausedBefore(p.recordedAt, pauses)) / 1000 });
    }
  }
  return { distanceM: st.distanceM, elevationGainM: st.elevationGainM, samples, accepted: st.accepted, rejected: st.rejected };
}
