import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { ProgressRing } from '@/components/charts/Charts';
import { CARDIO_ACTIVITIES, RUN_ACTIVITIES } from '@/constants/activities';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { stepSupport, stepsToday } from '@/services/pedometer';
import { notify } from '@/services/dialogs';
import { localDay } from '@/utils/dates';
import { formatDuration } from '@/utils/units';

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
    return { profile: r.profile.get(), daily: r.daily.get(today), counters: r.counters.listWithToday(today).slice(0, 4), items, activeRun: r.running.getActive() };
  });
  const setStepsM = useDbMutation((r, n: number) => r.daily.setSteps(today, n, 'manual'));
  const sensor = useDbMutation(async (r, _: void) => {
    const sup = await stepSupport();
    if (!sup.supported) { notify('Step sensor unavailable', sup.reason); return; }
    const n = await stepsToday();
    if (n == null) { notify('Not available on this device', 'Android only reports steps while an app is listening, so today\'s total cannot be read back. Enter your steps manually.'); return; }
    r.daily.setSteps(today, n, 'pedometer');
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
              <Button style={{ flex: 1 }} variant="secondary" title="Phone sensor" onPress={() => sensor.mutate()} /></Row>
          </View>
        </Row>
        <Text variant="muted">{data?.daily.stepsSource === 'pedometer' ? 'Last value came from the phone step sensor.' : 'Value was entered manually. FitTrack does not count steps in the background.'}</Text>
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
