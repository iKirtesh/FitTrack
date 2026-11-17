import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, CommitField, Field, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { WEEKDAYS } from '@/constants/profile';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { errorMessage, notify } from '@/services/dialogs';
import { displayToKg, kgToDisplay, round } from '@/utils/units';
import type { PlanItemInput } from '@/database/repositories/plans';

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const u = useUnits();
  const { data } = useDbQuery(['plan', id], (r) => r.plans.get(id));
  const [day, setDay] = React.useState<number>(1);
  const [name, setName] = React.useState<string | null>(null);
  const save = useDbMutation((r, items: PlanItemInput[]) => r.plans.setItems(id, items));
  const rename = useDbMutation((r, n: string) => r.plans.rename(id, n), { onSuccess: () => setName(null) });
  const start = useDbMutation((r, dow: number) => r.workouts.start({ name: data?.items.find((i) => i.dayOfWeek === dow)?.dayName ?? data?.plan.name, planId: id, dayOfWeek: dow }), { onSuccess: () => router.replace('/workout/active') });
  if (!data) return null;
  const toInput = (i: (typeof data.items)[number]): PlanItemInput => ({ dayOfWeek: i.dayOfWeek, dayName: i.dayName, exerciseId: i.exerciseId, targetSets: i.targetSets, targetReps: i.targetReps, targetWeightKg: i.targetWeightKg, targetDurationSec: i.targetDurationSec, targetDistanceM: i.targetDistanceM, restSec: i.restSec });
  const all = data.items.map(toInput);
  const patch = (itemId: string, p: Partial<PlanItemInput>) => save.mutate(data.items.map((i) => (i.id === itemId ? { ...toInput(i), ...p } : toInput(i))));
  const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const dayItems = data.items.filter((i) => i.dayOfWeek === day);
  const scheduledDays = new Set(data.items.map((i) => i.dayOfWeek));
  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...dayItems]; const j = idx + dir; if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j]!, arr[idx]!];
    save.mutate([...data.items.filter((i) => i.dayOfWeek !== day).map(toInput), ...arr.map(toInput)]);
  };
  return (
    <Screen>
      <Card>
        <Field label="Plan name" value={name ?? data.plan.name} onChangeText={setName} />
        {name != null && name !== data.plan.name ? <Button title="Save name" onPress={() => rename.mutate(name)} /> : null}
      </Card>
      <ChipRow>{WEEKDAYS.map((w, i) => <Chip key={w} label={`${w}${scheduledDays.has(i) ? ' •' : ''}`} selected={day === i} onPress={() => setDay(i)} />)}</ChipRow>
      <SectionHeader title={dayItems[0]?.dayName ?? WEEKDAYS[day]!} />
      {dayItems.length === 0 ? <Text variant="muted">Rest day. Add an exercise to schedule a workout on this day.</Text> : null}
      {dayItems.map((it, idx) => (
        <Card key={it.id}>
          <Row style={{ justifyContent: 'space-between' }}><Text variant="h2" style={{ flex: 1 }}>{it.exerciseName}</Text>
            <Button title="↑" variant="secondary" onPress={() => move(idx, -1)} /><Button title="↓" variant="secondary" onPress={() => move(idx, 1)} />
            <Button title="✕" variant="danger" onPress={() => save.mutate(all.filter((_, k) => data.items[k]!.id !== it.id))} /></Row>
          <Row>
            <View style={{ flex: 1 }}><CommitField label="Sets" initial={String(it.targetSets)} keyboardType="number-pad" onCommit={(t) => { const n = num(t); if (n) patch(it.id, { targetSets: Math.round(n) }); }} /></View>
            {it.trackingType === 'timed' || it.trackingType === 'duration' ? (
              <View style={{ flex: 1 }}><CommitField label="Seconds" initial={it.targetDurationSec ? String(it.targetDurationSec) : ''} keyboardType="number-pad" onCommit={(t) => patch(it.id, { targetDurationSec: num(t) })} /></View>
            ) : (
              <View style={{ flex: 1 }}><CommitField label="Reps" initial={it.targetReps ? String(it.targetReps) : ''} keyboardType="number-pad" onCommit={(t) => patch(it.id, { targetReps: num(t) })} /></View>
            )}
            {it.trackingType === 'weight_reps' || it.trackingType === 'assisted' ? (
              <View style={{ flex: 1 }}><CommitField label={`Weight (${u.wu})`} initial={it.targetWeightKg ? String(round(kgToDisplay(it.targetWeightKg, u.wu))) : ''} keyboardType="decimal-pad" onCommit={(t) => { const n = num(t); patch(it.id, { targetWeightKg: n == null ? null : displayToKg(n, u.wu) }); }} /></View>
            ) : null}
            <View style={{ flex: 1 }}><CommitField label="Rest (s)" initial={String(it.restSec)} keyboardType="number-pad" onCommit={(t) => { const n = num(t); if (n != null) { try { patch(it.id, { restSec: Math.round(n) }); } catch (er) { notify('Invalid', errorMessage(er)); } } }} /></View>
          </Row>
        </Card>
      ))}
      <Button title="+ Add exercise to this day" variant="secondary" onPress={() => router.push({ pathname: '/exercises/pick', params: { planId: id, day: String(day) } })} />
      {dayItems.length > 0 ? <Button title="Start this workout now" onPress={() => start.mutate(day)} /> : null}
    </Screen>
  );
}
