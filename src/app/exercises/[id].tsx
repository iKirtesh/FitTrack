import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from '@/components/charts/Charts';
import { Button, Card, Row, Screen, Segmented, Stat, Text } from '@/components/ui';
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, TRACKING_LABEL, type Equipment, type TrackingType } from '@/constants/exercise';
import { RANGES, type RangeKey } from '@/database/repositories/analytics';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { confirm } from '@/services/dialogs';
import { recordLabel, recordValue } from '@/features/records/labels';
import { kgToDisplay, round } from '@/utils/units';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const u = useUnits();
  const [range, setRange] = useState<RangeKey>('90d');
  const { data } = useDbQuery(['exercise', id, range], (r) => ({
    ex: r.exercises.get(id), prs: r.records.forExercise(id), history: r.workouts.setHistory(id, 30), progress: r.analytics.exerciseProgression(id, range), used: r.exercises.usageCount(id),
  }));
  const del = useDbMutation((r, _: void) => r.exercises.deleteCustom(id), { onSuccess: () => router.back() });
  if (!data?.ex) return null;
  const { ex } = data;
  const muscle = (m: string) => MUSCLE_GROUPS.find((x) => x.id === m)?.name ?? m;
  return (
    <Screen>
      <Text variant="h1">{ex.name}</Text>
      <Card>
        <Row><Stat label="Muscle" value={muscle(ex.muscleGroupId)} /><Stat label="Equipment" value={EQUIPMENT_LABEL[ex.equipment as Equipment]} /></Row>
        <Row><Stat label="Tracking" value={TRACKING_LABEL[ex.trackingType as TrackingType]} /><Stat label="Difficulty" value={ex.difficulty} /></Row>
        {ex.secondaryMuscles.length ? <Text variant="muted">Also works: {ex.secondaryMuscles.map(muscle).join(', ')}</Text> : null}
      </Card>
      {ex.instructions ? <Card><Text variant="label">How to</Text><Text>{ex.instructions}</Text><Text variant="muted">Illustrations are not bundled yet; instructions are text only.</Text></Card> : null}
      {data.prs.length ? <Card><Text variant="label">Your records</Text>{data.prs.map((p) => <Row key={p.id} style={{ justifyContent: 'space-between' }}><Text>{recordLabel(p.kind, null)}</Text><Text variant="muted">{recordValue(p, u)}{p.kind === 'est_1rm' ? ' (estimated)' : ''}</Text></Row>)}</Card> : null}
      <Card>
        <Text variant="label">Strength progression (top set, {u.wu})</Text>
        <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.key, label: r.label }))} />
        {data.progress.length >= 2 ? <LineChart data={data.progress.map((p) => ({ label: p.date.slice(5), value: round(kgToDisplay(p.topWeightKg, u.wu), 1) }))} /> : <Text variant="muted">Log this exercise in at least two workouts in this range to see a trend.</Text>}
      </Card>
      <Card>
        <Text variant="label">Recent sets</Text>
        {data.history.length === 0 ? <Text variant="muted">No completed sets yet.</Text> : data.history.map((h) => <Row key={h.setId} style={{ justifyContent: 'space-between' }}><Text variant="muted">{h.date} · set {h.setOrder}</Text><Text>{h.weightKg != null ? u.weight(h.weightKg) : ''} {h.reps != null ? `× ${h.reps}` : ''}{h.durationSec != null ? `${h.durationSec}s` : ''}{h.distanceM != null ? `${h.distanceM} m` : ''}</Text></Row>)}
      </Card>
      {ex.isCustom ? <Button variant="danger" title="Delete custom exercise" onPress={async () => { if (await confirm('Delete exercise?', data.used ? `It is used ${data.used} times and cannot be deleted.` : 'This cannot be undone.', 'Delete', true)) del.mutate(); }} /> : null}
    </Screen>
  );
}
