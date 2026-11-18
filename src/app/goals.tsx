import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, EmptyState, Field, Pill, Row, Screen, Segmented, Text } from '@/components/ui';
import { goalSchema } from '@/types/schemas';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { confirm } from '@/services/dialogs';
import { displayToKg, displayToM, kgToDisplay, mToDisplay, round } from '@/utils/units';

type Kind = 'weight' | 'workouts_per_week' | 'weekly_distance';
export default function Goals() {
  const u = useUnits();
  const { data } = useDbQuery(['goals'], (r) => r.goals.list());
  const [kind, setKind] = useState<Kind>('weight');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const create = useDbMutation((r, v: Parameters<typeof r.goals.create>[0]) => r.goals.create(v), { onSuccess: () => { setTarget(''); setErr(null); } });
  const abandon = useDbMutation((r, id: string) => r.goals.abandon(id));
  const del = useDbMutation((r, id: string) => r.goals.remove(id));
  const t = parseFloat(target.replace(',', '.'));
  const submit = () => {
    if (!Number.isFinite(t)) return setErr('Enter a target number');
    const v = kind === 'weight' ? { type: kind, title: `Reach ${t} ${u.wu}`, targetValue: displayToKg(t, u.wu), unit: 'kg' }
      : kind === 'workouts_per_week' ? { type: kind, title: `${t} workouts per week`, targetValue: t, unit: 'workouts' }
      : { type: kind, title: `${t} ${u.du} per week`, targetValue: displayToM(t, u.du), unit: 'm' };
    const p = goalSchema.safeParse(v);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? 'Invalid goal');
    create.mutate(p.data);
  };
  const shown = (g: NonNullable<typeof data>[number]) => (g.type === 'weight' ? `${u.weight(g.current)} of ${u.weight(g.targetValue)}` : g.type === 'weekly_distance' ? `${round(mToDisplay(g.current ?? 0, u.du))} of ${round(mToDisplay(g.targetValue, u.du))} ${u.du} this week` : `${g.current ?? 0} of ${g.targetValue} this week`);
  return (
    <Screen>
      <Card>
        <Text variant="h2">New goal</Text>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'weight', label: 'Weight' }, { value: 'workouts_per_week', label: 'Workouts/wk' }, { value: 'weekly_distance', label: 'Distance/wk' }]} />
        <Field label={kind === 'weight' ? `Target weight (${u.wu})` : kind === 'workouts_per_week' ? 'Workouts per week' : `Distance per week (${u.du})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" error={err} />
        <Button title="Add goal" onPress={submit} />
      </Card>
      {data && data.length === 0 ? <EmptyState title="No goals yet" body="Progress is calculated from your recorded weight, workouts and runs." /> : null}
      {(data ?? []).map((g) => (
        <Card key={g.id}>
          <Row style={{ justifyContent: 'space-between' }}><Text variant="h2" style={{ flex: 1 }}>{g.title}</Text><Pill tone={g.status === 'completed' ? 'success' : g.status === 'abandoned' ? 'muted' : 'primary'} text={g.status.toUpperCase()} /></Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#8884', overflow: 'hidden' }}><View style={{ width: `${Math.round(g.progress * 100)}%`, height: 8, backgroundColor: '#FF964F' }} /></View>
          <Text variant="muted">{shown(g)} · {Math.round(g.progress * 100)}%</Text>
          <Row>
            {g.status === 'active' ? <Button title="Abandon" variant="secondary" onPress={() => abandon.mutate(g.id)} /> : null}
            <Button title="Delete" variant="danger" onPress={async () => { if (await confirm('Delete goal?', g.title, 'Delete', true)) del.mutate(g.id); }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
