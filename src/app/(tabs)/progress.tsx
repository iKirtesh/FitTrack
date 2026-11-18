import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Row, Screen, SectionHeader, Segmented, Stat, Text } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts/Charts';
import { MuscleMap } from '@/components/MuscleMap';
import { MUSCLE_GROUPS } from '@/constants/exercise';
import { RANGES, type RangeKey } from '@/database/repositories/analytics';
import { useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { formatDuration, kgToDisplay, round } from '@/utils/units';

const short = (d: string) => d.slice(5);

export default function Progress() {
  const router = useRouter();
  const u = useUnits();
  const [range, setRange] = useState<RangeKey>('30d');
  const { data } = useDbQuery(['progress', range], (r) => {
    const profile = r.profile.get();
    return {
      w: r.analytics.workoutStats(range), run: r.analytics.runningStats(range), weight: r.analytics.weightSeries(range),
      change: r.analytics.weightChange(), cons: r.analytics.consistency(range, Math.max(1, profile?.preferredWorkoutDays.length || 3)),
      steps: r.analytics.dailyActivityTrend(range), goals: r.goals.list({ status: 'active' }),
    };
  });
  if (!data) return <Screen><Text variant="muted">Loading…</Text></Screen>;
  const { w, run, weight, change, cons, steps, goals } = data;
  const empty = w.totalWorkouts === 0 && run.count === 0 && weight.length === 0;
  const groupName = (id: string) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id;
  const delta = (v: number | null) => (v == null ? '-' : `${v > 0 ? '+' : ''}${round(kgToDisplay(v, u.wu))} ${u.wu}`);

  return (
    <Screen>
      <Segmented value={range} onChange={setRange} options={RANGES.map((x) => ({ value: x.key, label: x.label }))} />
      {empty ? <EmptyState title="Nothing to chart yet" body="Finish a workout, log a run or record your weight and your progress will show up here." /> : null}

      <Card>
        <SectionHeader title="Workouts" />
        <Row><Stat label="Total" value={String(w.totalWorkouts)} /><Stat label="Time" value={formatDuration(w.totalSeconds)} /><Stat label="Per week" value={round(w.avgPerWeek).toString()} /></Row>
        <Stat label="Total lifting volume" value={u.weight(w.totalVolumeKg, 0)} sub="Completed working sets, warm-ups excluded" />
        {w.weekly.length ? <><Text variant="label">Workouts per week</Text><BarChart data={w.weekly.slice(-12).map((x) => ({ label: short(x.date), value: x.value }))} highlightLast /></> : null}
        {w.muscleDistribution.length ? (
          <View style={{ gap: 6 }}>
            <Text variant="label">Body parts trained (darker = more sets)</Text>
            <MuscleMap heat={Object.fromEntries(w.muscleDistribution.map((m) => [m.groupId, m.share]))} height={220} />
            <Text variant="label">Muscle group distribution (share of completed sets)</Text>
            <BarChart data={w.muscleDistribution.slice(0, 8).map((m) => ({ label: groupName(m.groupId).slice(0, 5), value: Math.round(m.share * 100) }))} formatValue={(n) => `${n}%`} />
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Running & walking" />
        <Row><Stat label="Sessions" value={String(run.count)} /><Stat label="Distance" value={u.distance(run.totalDistanceM)} /><Stat label="Avg run pace" value={u.pace(run.avgPaceSecPerKm)} /></Row>
        <Row><Stat label="Longest run" value={u.distance(run.longestRunM)} /><Stat label="Fastest km" value={u.pace(run.fastestKmSecPerKm)} sub="GPS splits only" /></Row>
        {run.weekly.length ? <><Text variant="label">Weekly distance ({u.du})</Text><BarChart data={run.weekly.slice(-12).map((x) => ({ label: short(x.date), value: round(u.du === 'km' ? x.value / 1000 : x.value / 1609.344) }))} highlightLast /></> : null}
        {run.paceSeries.length > 1 ? <><Text variant="label">Pace per run (lower is faster)</Text><LineChart invert data={run.paceSeries.map((p) => ({ label: short(p.date), value: p.value }))} formatValue={(n) => u.pace(n)} /></> : null}
      </Card>

      <Card>
        <SectionHeader title="Body weight" action={<Button title="Measurements" variant="secondary" onPress={() => router.push('/measurements')} />} />
        <Row><Stat label="Latest" value={u.weight(change.latest)} /><Stat label="7 days" value={delta(change.weekly)} /><Stat label="30 days" value={delta(change.monthly)} /></Row>
        {weight.length > 1 ? <LineChart data={weight.map((p) => ({ label: short(p.date), value: round(kgToDisplay(p.value, u.wu)) }))} /> : <Text variant="muted">Record at least two weigh-ins to see a trend.</Text>}
      </Card>

      <Card>
        <SectionHeader title="Consistency" />
        <Text variant="muted">Weeks with at least your preferred number of active days (workouts or runs).</Text>
        <Stat label="Weeks met" value={`${cons.weeksMet} of ${cons.totalWeeks}`} />
        {steps.some((s) => s.steps > 0) ? <><Text variant="label">Daily steps</Text><BarChart data={steps.slice(-14).map((s) => ({ label: short(s.date), value: s.steps }))} /></> : null}
      </Card>

      <Card>
        <SectionHeader title="Goals" action={<Button title="Manage" variant="secondary" onPress={() => router.push('/goals')} />} />
        {goals.length === 0 ? <Text variant="muted">No active goals.</Text> : goals.map((g) => (
          <View key={g.id} style={{ gap: 2 }}><Text>{g.title}</Text><Text variant="muted">{Math.round(g.progress * 100)}% complete</Text></View>
        ))}
      </Card>
      <Row>
        <Button style={{ flex: 1 }} variant="secondary" title="Personal records" onPress={() => router.push('/records')} />
        <Button style={{ flex: 1 }} variant="secondary" title="Achievements" onPress={() => router.push('/achievements')} />
      </Row>
    </Screen>
  );
}
