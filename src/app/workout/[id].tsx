import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MuscleMap } from '@/components/MuscleMap';
import { Button, Card, Pill, Row, Screen, Stat, Text } from '@/components/ui';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { confirm } from '@/services/dialogs';
import { formatDuration } from '@/utils/units';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const u = useUnits();
  const { data: w } = useDbQuery(['workout', id], (r) => { try { return r.workouts.getDetail(id); } catch { return null; } });
  const del = useDbMutation((r, _: void) => r.workouts.remove(id), { onSuccess: () => router.back() });
  const heat: Record<string, number> = {};
  for (const e of w?.exercises ?? []) { const n = e.sets.filter((s) => s.isCompleted && s.kind !== 'warmup').length; if (n) heat[e.muscleGroupId] = (heat[e.muscleGroupId] ?? 0) + n; }
  if (!w) return <Screen><Text variant="muted">This workout no longer exists.</Text></Screen>;
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}><Text variant="h1" style={{ flex: 1 }}>{w.name}</Text><Pill text={w.status.replace('_', ' ').toUpperCase()} tone={w.status === 'completed' ? 'success' : 'warning'} /></Row>
      <Text variant="muted">{new Date(w.startedAt).toLocaleString()}{w.endedAt ? ` – ${new Date(w.endedAt).toLocaleTimeString()}` : ''}</Text>
      <Card>
        <Row><Stat label="Duration" value={formatDuration(w.durationSec)} /><Stat label="Volume" value={u.weight(w.totalVolumeKg, 0)} /><Stat label="Sets" value={String(w.setCount)} /></Row>
        <Row><Stat label="RPE" value={w.rpe != null ? String(w.rpe) : '-'} /><Stat label="Calories (est.)" value={w.caloriesEstimate != null ? String(w.caloriesEstimate) : '-'} sub="MET-based estimate" /></Row>
      </Card>
      {heat && Object.keys(heat).length ? <Card><Text variant="label">Body parts worked (completed sets)</Text><MuscleMap heat={heat} height={200} /></Card> : null}
      {w.notes ? <Card><Text variant="label">Notes</Text><Text>{w.notes}</Text></Card> : null}
      {w.exercises.map((e) => (
        <Card key={e.id} onPress={() => router.push(`/exercises/${e.exerciseId}`)}>
          <Text variant="h2">{e.name}</Text>
          {e.sets.map((s, i) => <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <Text variant="muted">{s.kind === 'warmup' ? 'Warm-up' : `Set ${i + 1}`}{!s.isCompleted ? ' (not completed)' : ''}</Text>
            <Text>{s.weightKg != null ? u.weight(s.weightKg) : ''}{s.reps != null ? ` × ${s.reps}` : ''}{s.durationSec != null ? ` ${s.durationSec}s` : ''}{s.distanceM != null ? ` ${s.distanceM} m` : ''}</Text></Row>)}
        </Card>
      ))}
      <Button variant="danger" title="Delete workout" onPress={async () => { if (await confirm('Delete workout?', 'This workout and all of its sets will be permanently deleted.', 'Delete', true)) del.mutate(); }} />
    </Screen>
  );
}
