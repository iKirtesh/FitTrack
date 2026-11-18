import React, { useState } from 'react';
import { View } from 'react-native';
import { BarChart } from '@/components/charts/Charts';
import { Button, Card, Field, Row, Screen, Segmented, SectionHeader, Text } from '@/components/ui';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { addDays, localDay, parseDay } from '@/utils/dates';
import { confirm } from '@/services/dialogs';
import { counterSchema, type CounterInput } from '@/types/schemas';
import { errorMessage } from '@/services/dialogs';

export default function Counters() {
  const today = localDay();
  const [open, setOpen] = useState<string | null>(null);
  const [span, setSpan] = useState<'week' | 'month'>('week');
  const [name, setName] = useState(''); const [unit, setUnit] = useState('reps'); const [step, setStep] = useState('1'); const [target, setTarget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { data } = useDbQuery(['counters', today, open ?? '', span], (r) => ({
    list: r.counters.listWithToday(today),
    stats: open ? r.counters.stats(open, today) : null,
    series: open ? r.counters.series(open, addDays(today, span === 'week' ? -6 : -29), today) : [],
  }));
  const add = useDbMutation((r, a: { id: string; delta: number }) => r.counters.add(a.id, a.delta));
  const reset = useDbMutation((r, id: string) => r.counters.reset(id));
  const undo = useDbMutation((r, id: string) => r.counters.undoLast(id));
  const create = useDbMutation((r, v: CounterInput) => r.counters.create(v), { onSuccess: () => { setName(''); setTarget(''); setStep('1'); } });
  const remove = useDbMutation((r, id: string) => r.counters.remove(id));
  const archive = useDbMutation((r, a: { id: string; archived: boolean }) => r.counters.archive(a.id, a.archived));

  return (
    <Screen>
      {(data?.list ?? []).map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text variant="h2">{c.name}</Text><Text variant="muted">{c.today}{c.dailyTarget ? ` / ${c.dailyTarget}` : ''} {c.unit} today</Text></View>
            <Button title="-" variant="secondary" onPress={() => add.mutate({ id: c.id, delta: -c.step })} />
            <Button title={`+${c.step}`} onPress={() => add.mutate({ id: c.id, delta: c.step })} />
          </Row>
          {c.dailyTarget ? <View style={{ height: 8, borderRadius: 4, backgroundColor: '#8884', overflow: 'hidden' }}><View style={{ height: 8, width: `${Math.min(100, (c.today / c.dailyTarget) * 100)}%`, backgroundColor: '#FF964F' }} /></View> : null}
          <Row>
            <Button variant="ghost" title={open === c.id ? 'Hide stats' : 'Stats'} onPress={() => setOpen(open === c.id ? null : c.id)} />
            <Button variant="ghost" title="Undo" onPress={() => undo.mutate(c.id)} />
            <Button variant="ghost" title="Reset" onPress={async () => { if (await confirm('Reset today?', `Set ${c.name} to 0 for today. You can undo this right after.`, 'Reset', true)) reset.mutate(c.id); }} />
            {c.isBuiltIn ? <Button variant="ghost" title="Hide" onPress={() => archive.mutate({ id: c.id, archived: true })} /> : <Button variant="ghost" title="Delete" onPress={async () => { if (await confirm('Delete counter?', `${c.name} and its entire history will be deleted.`, 'Delete', true)) remove.mutate(c.id); }} />}
          </Row>
          {open === c.id && data?.stats ? (
            <View style={{ gap: 8 }}>
              <Segmented value={span} onChange={setSpan} options={[{ value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }]} />
              <BarChart data={data.series.map((d) => ({ label: span === 'week' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parseDay(d.date).getDay()]! : d.date.slice(8), value: d.total }))} highlightLast />
              <Text variant="muted">This week: {data.stats.weekTotal} (avg {data.stats.weekDailyAverage.toFixed(1)}/day) · Last 30 days: {data.stats.monthTotal} · Best day: {data.stats.best}{data.stats.daysTargetHit != null ? ` · Target hit ${data.stats.daysTargetHit} days` : ''}</Text>
            </View>
          ) : null}
        </Card>
      ))}
      <Card>
        <SectionHeader title="New counter" />
        <Field label="Name" value={name} onChangeText={setName} />
        <Row><Field label="Unit" value={unit} onChangeText={setUnit} /><Field label="Step" value={step} onChangeText={setStep} keyboardType="decimal-pad" /><Field label="Daily target" value={target} onChangeText={setTarget} keyboardType="decimal-pad" /></Row>
        {err ? <Text style={{ color: '#C0262D' }}>{err}</Text> : null}
        <Button title="Create counter" onPress={() => { const p = counterSchema.safeParse({ name, unit, step: parseFloat(step), dailyTarget: target ? parseFloat(target) : null }); if (!p.success) return setErr(errorMessage(p.error)); setErr(null); create.mutate(p.data); }} />
      </Card>
      <Text variant="muted">Counters are manual tallies. Steps and distance are tracked separately from recorded activities.</Text>
    </Screen>
  );
}
