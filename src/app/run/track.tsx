import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, Chip, ChipRow, Pill, Row, Screen, Stat, Text } from '@/components/ui';
import { RouteView } from '@/components/charts/Charts';
import { RUN_ACTIVITIES } from '@/constants/activities';
import { useRepos, useInvalidateAll } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { accuracyLevel, addPoint, emptyTrack, paceSecPerKm, type GeoPoint, type PauseInterval, type TrackState } from '@/services/running';
import { confirm, errorMessage, notify } from '@/services/dialogs';
import { formatDuration } from '@/utils/units';

type Phase = 'choose' | 'tracking' | 'paused';

/**
 * Foreground GPS tracking. Fixes are saved to SQLite every few points, so a crash or a killed app
 * keeps the route recorded so far. Background tracking is NOT implemented: if the screen locks or the
 * app is backgrounded, the OS may stop delivering fixes and the gap is simply not recorded.
 */
export default function Track() {
  useKeepAwake();
  const router = useRouter();
  const repos = useRepos();
  const refresh = useInvalidateAll();
  const u = useUnits();
  const gpsActivities = RUN_ACTIVITIES.filter((a) => a.gps);
  const [type, setType] = useState<string>('outdoor_run');
  const [phase, setPhase] = useState<Phase>('choose');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<{ distanceM: number; gain: number; accuracy: number | null; pace: number | null; rejected: number; route: { latitude: number; longitude: number }[] }>({ distanceM: 0, gain: 0, accuracy: null, pace: null, rejected: 0, route: [] });
  const [error, setError] = useState<string | null>(null);
  const st = useRef<TrackState>(emptyTrack());
  const buf = useRef<GeoPoint[]>([]);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const startedAt = useRef(0);
  const pauses = useRef<PauseInterval[]>([]);
  const pausedAt = useRef<number | null>(null);
  const route = useRef<{ latitude: number; longitude: number }[]>([]);

  const flush = useCallback((id: string | null) => {
    if (!id || !buf.current.length) return;
    const pts = buf.current; buf.current = [];
    try { repos.running.appendPoints(id, pts); } catch (e) { buf.current = [...pts, ...buf.current]; setError(`Could not save route points: ${errorMessage(e)}`); }
  }, [repos]);

  const listen = useCallback(async (id: string) => {
    sub.current?.remove();
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 }, (loc) => {
      if (pausedAt.current != null) return;
      const p: GeoPoint = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, altitudeM: loc.coords.altitude, accuracyM: loc.coords.accuracy, recordedAt: loc.timestamp };
      const before = st.current.accepted;
      st.current = addPoint(st.current, p);
      if (st.current.accepted > before) { buf.current.push(p); route.current.push({ latitude: p.latitude, longitude: p.longitude }); if (buf.current.length >= 5) flush(id); }
      const sp = loc.coords.speed;
      setView({ distanceM: st.current.distanceM, gain: st.current.elevationGainM, accuracy: loc.coords.accuracy, pace: sp && sp > 0.3 ? 1000 / sp : null, rejected: st.current.rejected, route: [...route.current] });
    });
  }, [flush]);

  // Resume an unfinished GPS session after an app restart.
  useEffect(() => {
    const active = repos.running.getActive();
    if (!active) return;
    setSessionId(active.id); setType(active.activityType); startedAt.current = active.startedAt;
    for (const p of repos.running.routePoints(active.id)) { st.current = addPoint(st.current, p); route.current.push({ latitude: p.latitude, longitude: p.longitude }); }
    setView((v) => ({ ...v, distanceM: st.current.distanceM, gain: st.current.elevationGainM, route: [...route.current] }));
    // Time since the last recorded fix (app closed or killed) is treated as paused until the user resumes.
    pausedAt.current = repos.running.routePoints(active.id).at(-1)?.recordedAt ?? Date.now();
    setPhase('paused');
  }, [repos]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { sub.current?.remove(); }, []);

  const start = async () => {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { setError('Location permission was denied. Enable it in system settings, or log the activity manually.'); return; }
    try {
      const s = repos.running.startTracking(type);
      setSessionId(s.id); startedAt.current = s.startedAt; st.current = emptyTrack(); route.current = []; pauses.current = []; pausedAt.current = null;
      setPhase('tracking'); await listen(s.id); void refresh();
    } catch (e) { setError(errorMessage(e)); }
  };
  const pause = () => { pausedAt.current = Date.now(); setPhase('paused'); flush(sessionId); };
  const resume = async () => {
    if (pausedAt.current != null) pauses.current.push({ from: pausedAt.current, to: Date.now() });
    pausedAt.current = null; st.current = { ...st.current, last: null }; // don't bridge the pause gap as distance
    setPhase('tracking'); if (sessionId) await listen(sessionId);
  };
  const finish = async () => {
    if (!sessionId) return;
    if (st.current.distanceM < 50 && !(await confirm('Very short activity', 'Less than 50 m was recorded. Save it anyway?', 'Save'))) return;
    sub.current?.remove(); flush(sessionId);
    const end = Date.now();
    const all = pausedAt.current != null ? [...pauses.current, { from: pausedAt.current, to: end }] : pauses.current;
    try {
      const { session } = repos.running.finishTracking(sessionId, { endedAt: end, pauses: all });
      void refresh(); router.replace(`/run/${session.id}`);
    } catch (e) { notify('Could not save activity', errorMessage(e)); }
  };
  const discard = async () => {
    if (!sessionId || !(await confirm('Discard this activity?', 'The recorded route will be deleted.', 'Discard', true))) return;
    sub.current?.remove(); buf.current = []; repos.running.remove(sessionId); void refresh(); router.back();
  };

  const pausedMs = pauses.current.reduce((a, p) => a + (p.to - p.from), 0) + (pausedAt.current != null ? now - pausedAt.current : 0);
  const moving = phase === 'choose' ? 0 : Math.max(0, Math.round((now - startedAt.current - pausedMs) / 1000));
  const acc = accuracyLevel(view.accuracy);
  const avg = paceSecPerKm(view.distanceM, moving);

  if (phase === 'choose') {
    return (
      <Screen>
        <Card>
          <Text variant="h2">Choose activity</Text>
          <ChipRow>{gpsActivities.map((a) => <Chip key={a.id} label={a.label} selected={type === a.id} onPress={() => setType(a.id)} />)}</ChipRow>
          <Text variant="muted">Distance and route come from your phone's GPS while this screen is open. {Platform.OS === 'web' ? 'In a browser, location only works while this tab stays open and visible.' : 'Keep the app open: background tracking is not enabled in this version.'}</Text>
          {error ? <Text style={{ color: '#E5484D' }}>{error}</Text> : null}
          <Button title="Start" onPress={start} />
          <Button title="Log manually instead" variant="secondary" onPress={() => router.replace('/run/manual')} />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen>
      <Card>
        <Text variant="big" style={{ textAlign: 'center' }}>{formatDuration(moving)}</Text>
        <Text variant="muted" style={{ textAlign: 'center' }}>{phase === 'paused' ? 'Paused' : 'Moving time'}</Text>
        <Row><Stat label="Distance" value={u.distance(view.distanceM)} /><Stat label="Current pace" value={u.pace(view.pace)} /><Stat label="Avg pace" value={u.pace(avg)} /></Row>
        <Row><Stat label="Elevation gain" value={`${Math.round(view.gain)} m`} sub="GPS altitude is approximate" /><View style={{ flex: 1, gap: 4 }}><Text variant="label">GPS signal</Text><Pill tone={acc === 'good' ? 'success' : acc === 'fair' ? 'warning' : acc === 'poor' ? 'danger' : 'muted'} text={view.accuracy != null ? `${acc} (±${Math.round(view.accuracy)} m)` : 'waiting for fix'} /></View></Row>
      </Card>
      {view.route.length > 1 ? <RouteView points={view.route} /> : null}
      {view.rejected > 0 ? <Text variant="muted">{view.rejected} low-accuracy or implausible GPS readings were ignored.</Text> : null}
      {error ? <Text style={{ color: '#E5484D' }}>{error}</Text> : null}
      <Row>
        {phase === 'tracking' ? <Button style={{ flex: 1 }} variant="secondary" title="Pause" onPress={pause} /> : <Button style={{ flex: 1 }} title="Resume" onPress={resume} />}
        <Button style={{ flex: 1 }} title="Finish" onPress={finish} />
      </Row>
      <Button title="Discard" variant="danger" onPress={discard} />
    </Screen>
  );
}
