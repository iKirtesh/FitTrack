import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Pill, Row, Screen, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/data';
import { useTheme } from '@/theme/ThemeProvider';
import { addDays, localDay, parseDay, startOfWeek } from '@/utils/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = localDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState<string | null>(today);
  const first = `${month}-01`;
  const gridStart = startOfWeek(first);
  const d = parseDay(first); d.setMonth(d.getMonth() + 1);
  const last = addDays(localDay(d.getTime()), -1);
  const { data } = useDbQuery(['calendar', month], (r) => ({ days: r.plans.calendar(gridStart, addDays(startOfWeek(last), 6), today), plan: r.plans.getActive(), workouts: r.workouts.history({ from: gridStart, to: last, limit: 100 }), runs: r.running.list({ from: gridStart, to: last, limit: 100 }) }));
  const shift = (n: number) => { const x = parseDay(first); x.setMonth(x.getMonth() + n); setMonth(localDay(x.getTime()).slice(0, 7)); };
  const color = { completed: colors.success, missed: colors.danger, planned: colors.primary, extra: colors.warning, rest: 'transparent' } as const;
  const selDay = data?.days.find((x) => x.date === sel);
  const [y, m] = month.split('-').map(Number) as [number, number];
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}><Button title="‹" variant="secondary" onPress={() => shift(-1)} /><Text variant="h2">{MONTHS[m - 1]} {y}</Text><Button title="›" variant="secondary" onPress={() => shift(1)} /></Row>
      <Card>
        <Row>{HEAD.map((h, i) => <Text key={i} variant="label" style={{ flex: 1, textAlign: 'center' }}>{h}</Text>)}</Row>
        {data ? Array.from({ length: data.days.length / 7 }, (_, w) => (
          <Row key={w}>{data.days.slice(w * 7, w * 7 + 7).map((c) => (
            <Pressable key={c.date} accessibilityRole="button" accessibilityLabel={`${c.date}, ${c.status}`} onPress={() => setSel(c.date)} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: sel === c.date ? 2 : 0, borderColor: colors.primary, opacity: c.date.startsWith(month) ? 1 : 0.35 }}>
              <Text>{Number(c.date.slice(8))}</Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color[c.status] }} />
            </Pressable>
          ))}</Row>
        )) : null}
        <Row style={{ flexWrap: 'wrap', gap: 8 }}><Pill tone="success" text="Completed" /><Pill tone="danger" text="Missed" /><Pill tone="primary" text="Planned" /><Pill tone="warning" text="Unplanned activity" /></Row>
        {!data?.plan ? <Text variant="muted">Set a plan active to see planned and missed days. Missed days are only counted from the day the plan was activated.</Text> : <Text variant="muted">Active plan: {data.plan.name}</Text>}
      </Card>
      {sel && selDay ? (
        <Card>
          <Text variant="h2">{sel}</Text>
          {selDay.planned.length ? <Text variant="muted">Planned: {selDay.planned.join(', ')}</Text> : <Text variant="muted">No workout planned.</Text>}
          {data!.workouts.filter((w) => w.date === sel).map((w) => <Button key={w.id} variant="secondary" title={`Workout: ${w.name}`} onPress={() => router.push(`/workout/${w.id}`)} />)}
          {data!.runs.filter((r) => r.date === sel).map((r) => <Button key={r.id} variant="secondary" title={`Run/walk: ${(r.distanceM / 1000).toFixed(2)} km`} onPress={() => router.push(`/run/${r.id}`)} />)}
        </Card>
      ) : null}
    </Screen>
  );
}
