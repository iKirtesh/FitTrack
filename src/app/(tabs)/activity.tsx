import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { BarChart, ProgressRing } from '@/components/charts/Charts';
import { CARDIO_ACTIVITIES, RUN_ACTIVITIES } from '@/constants/activities';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { stepSupport, stepsToday, watchSteps } from '@/services/pedometer';
import { notify } from '@/services/dialogs';
import { addDays, localDay, parseDay } from '@/utils/dates';
import { formatDuration } from '@/utils/units';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Active minutes per day for the last 7 days, from recorded runs and cardio sessions only. */
function weekMinutes(r: { running: { list: (o: { from?: string; to?: string }) => { startedAt: number; durationSec: number }[] }; cardio: { list: (o: { from?: string; to?: string }) => { startedAt: number; durationSec: number }[] } }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(localDay(), i - 6));
  const sums = new Map(days.map((d) => [d, 0]));
  for (const s of [...r.running.list({ from: days[0], to: days[6] }), ...r.cardio.list({ from: days[0], to: days[6] })]) {
    const d = localDay(s.startedAt);
    if (sums.has(d)) sums.set(d, sums.get(d)! + s.durationSec / 60);
  }
  return days.map((d) => ({ date: d, minutes: Math.round(sums.get(d)!) }));
}

export default function Activity() {
  const router = useRouter();
  const u = useUnits();
  const today = localDay();
  const [steps, setSteps] = useState('');
  const { data } = useDbQuery(['activity-tab', today], (r) => {
    const items = [
      ...r.running.list({ limit: 8 }).map((x) => ({ kind: 'run' as const, id: x.id, when: x.startedAt, title: RUN_ACTIVITIES.find((a) => a.id === x.activityType)?.label ?? x.activityType, detail: `${u.distance(x.distanceM)} · ${formatDuration(x.durationSec)} · ${u.pace(x.avgPaceSecPerKm)}${x.source === 'manual' ? ' · manual' : ''}` })),
      ...r.cardio.list({ limit: 8 }).map((x) => ({ kind: 'cardio' as const, id: x.id, when: x.startedAt, title: x.customName ?? CARDIO_ACTIVITIES.find((a) => a.id === x.activityType)?.label ?? x.activityType, detail: `${formatDuration(x.durationSec)}${x.distanceM ? ` · ${u.distance(x.distanceM)}` : ''}${x.caloriesEstimate ? ` · ~${x.caloriesEstimate} kcal` : ''}` })),
    ].sort((a, b) => b.when - a.when).slice(0, 10);
    return { profile: r.profile.get(), daily: r.daily.get(today), counters: r.counters.listWithToday(today).slice(0, 4), items, activeRun: r.running.getActive(), stepSeries: r.daily.range(addDays(today, -6), today), minutes: weekMinutes(r) };
  });
  const setStepsM = useDbMutation((r, n: number) => r.daily.setSteps(today, n, 'manual'));
  const [live, setLive] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const stepsRef = useRef(0);
  stepsRef.current = data?.daily.steps ?? 0;
  const saveLive = useDbMutation((r, n: number) => r.daily.setSteps(today, n, 'pedometer'));
  const sensor = useDbMutation(async (r, _: void) => {
    if (stop.current) { stop.current(); stop.current = null; setLive(false); return; }
    const sup = await stepSupport();
    if (!sup.supported) { notify('Step sensor unavailable', sup.reason); return; }
    const n = await stepsToday();
    if (n != null) { r.daily.setSteps(today, n, 'pedometer'); return; }
    // Android cannot read today's total back, so count from now on and add to what is saved.
    const baseline = stepsRef.current;
    stop.current = watchSteps((since) => saveLive.mutate(baseline + since));
    setLive(true);
  });
  const del = useDbMutation((r, a: { kind: 'run' | 'cardio'; id: string }) => (a.kind === 'run' ? r.running.remove(a.id) : r.cardio.remove(a.id)));
  const target = data?.profile?.dailyStepTarget ?? 8000;
  const bump = useDbMutation((r, a: { id: string; delta: number }) => r.counters.add(a.id, a.delta));

  return (
    <Screen>
      <Card>
        <SectionHeader title="Steps today" />
        <Row style={{ gap: 16 }}>
          <ProgressRing value={data ? data.daily.steps / target : 0} label={String(data?.daily.steps ?? 0)} sub={`/ ${target}`} />
          <View style={{ flex: 1, gap: 8 }}>
            <Field label="Enter steps" value={steps} onChangeText={setSteps} keyboardType="number-pad" placeholder={String(data?.daily.steps ?? 0)} />
            <Row><Button style={{ flex: 1 }} title="Save" disabled={!steps} onPress={() => { setStepsM.mutate(parseInt(steps, 10)); setSteps(''); }} />
              <Button style={{ flex: 1 }} variant="secondary" title={live ? 'Stop counting' : Platform.OS === 'ios' ? 'Phone sensor' : 'Count steps'} onPress={() => sensor.mutate()} /></Row>
          </View>
        </Row>
        <Text variant="muted">{data?.daily.stepsSource === 'pedometer' ? (live ? 'Counting steps while this app is open. Stops when you leave the app.' : 'Last value came from the phone step sensor.') : 'Value was entered manually. FitTrack does not count steps in the background.'}</Text>
      </Card>

      <Card>
        <SectionHeader title="Steps, last 7 days" />
        <BarChart data={(data?.stepSeries ?? []).map((d) => ({ label: DOW[parseDay(d.date).getDay()]!, value: d.steps }))} highlightLast />
        <SectionHeader title="Active minutes, last 7 days" />
        <BarChart data={(data?.minutes ?? []).map((d) => ({ label: DOW[parseDay(d.date).getDay()]!, value: d.minutes }))} formatValue={(n) => `${n}m`} highlightLast />
        <Text variant="muted">Minutes come from logged runs and cardio only.</Text>
      </Card>

      <Row>
        <Button style={{ flex: 1 }} title={data?.activeRun ? 'Resume GPS run' : 'Start run / walk'} onPress={() => router.push('/run/track')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Log manually" onPress={() => router.push('/run/manual')} />
      </Row>
      <Row>
        <Button style={{ flex: 1 }} variant="secondary" title="Log cardio" onPress={() => router.push('/cardio/new')} />
        <Button style={{ flex: 1 }} variant="secondary" title="All counters" onPress={() => router.push('/counters')} />
      </Row>

      <Card>
        <SectionHeader title="Counters today" />
        {(data?.counters ?? []).map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{c.name}</Text><Text variant="muted">{c.today}{c.dailyTarget ? ` / ${c.dailyTarget}` : ''} {c.unit}</Text></View>
            <Button title="-" variant="secondary" onPress={() => bump.mutate({ id: c.id, delta: -c.step })} />
            <Button title={`+${c.step}`} onPress={() => bump.mutate({ id: c.id, delta: c.step })} />
          </Row>
        ))}
      </Card>

      <SectionHeader title="Recent activities" />
      {data && data.items.length === 0 ? <Text variant="muted">No runs or cardio logged yet.</Text> : null}
      {(data?.items ?? []).map((a) => (
        <Card key={a.kind + a.id} onPress={a.kind === 'run' ? () => router.push(`/run/${a.id}`) : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{a.title}</Text><Text variant="muted">{new Date(a.when).toLocaleDateString()} · {a.detail}</Text></View>
            {a.kind === 'cardio' ? <Button title="Delete" variant="ghost" onPress={() => del.mutate({ kind: 'cardio', id: a.id })} /> : null}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
