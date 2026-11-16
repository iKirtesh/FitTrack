import React from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Pill, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { formatDuration } from '@/utils/units';

export default function Workouts() {
  const router = useRouter();
  const u = useUnits();
  const { data } = useDbQuery(['workouts-tab'], (r) => ({ active: r.workouts.getActive(), history: r.workouts.history({ limit: 100 }), plans: r.plans.list() }));
  return (
    <Screen>
      <Button title={data?.active ? 'Resume workout' : 'Start empty workout'} onPress={() => router.push('/workout/active')} />
      <Row>
        <Button style={{ flex: 1 }} variant="secondary" title="Exercises" onPress={() => router.push('/exercises')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Plans" onPress={() => router.push('/plans')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Calendar" onPress={() => router.push('/calendar')} />
      </Row>
      {data?.plans.length ? (
        <>
          <SectionHeader title="Start from a template" />
          {data.plans.slice(0, 4).map((p) => <Card key={p.id} onPress={() => router.push(`/plans/${p.id}`)}><Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700' }}>{p.name}</Text>{p.isActive ? <Pill text="ACTIVE" tone="success" /> : null}</Row><Text variant="muted">{p.exerciseCount} exercises</Text></Card>)}
        </>
      ) : null}
      <SectionHeader title="History" />
      {data && data.history.length === 0 ? <EmptyState title="No workouts yet" body="Finished workouts appear here and stay on your device until you delete them." /> : null}
      {(data?.history ?? []).map((w) => (
        <Card key={w.id} onPress={() => router.push(`/workout/${w.id}`)}>
          <Text style={{ fontWeight: '700' }}>{w.name}</Text>
          <Text variant="muted">{new Date(w.startedAt).toLocaleDateString()} · {formatDuration(w.durationSec)} · {w.setCount} sets · {u.weight(w.totalVolumeKg, 0)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
