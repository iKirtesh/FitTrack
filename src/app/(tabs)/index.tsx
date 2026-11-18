import React from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart, ProgressRing } from '@/components/charts/Charts';
import { Button, Card, EmptyState, Pill, Row, Screen, SectionHeader, Stat, Text } from '@/components/ui';
import { MuscleMap, muscleNames } from '@/components/MuscleMap';
import { DEFAULT_CARDS, type DashboardCardId } from '@/constants/dashboard';
import { RUN_ACTIVITIES } from '@/constants/activities';
import { useDbQuery, useInvalidateAll, useRepos } from '@/hooks/data';
import { errorMessage, notify } from '@/services/dialogs';
import { useTheme } from '@/theme/ThemeProvider';
import { useUnits } from '@/hooks/units';
import { greeting, localDay, parseDay, startOfWeek } from '@/utils/dates';
import { formatDuration } from '@/utils/units';
import { recordLabel, recordValue } from '@/features/records/labels';

export default function Home() {
  const router = useRouter();
  const u = useUnits();
  const { colors } = useTheme();
  const today = localDay();
  const repos = useRepos();
  const refresh = useInvalidateAll();
  const { data } = useDbQuery(['home', today], (r) => {
    const profile = r.profile.get();
    const weekStart = startOfWeek(today);
    const week = r.workouts.history({ from: weekStart, to: today, limit: 100 });
    const runs = r.running.list({ from: weekStart, to: today, limit: 100 });
    const activePlan = r.plans.getActive();
    const planned = activePlan ? r.plans.get(activePlan.id).items.filter((i) => i.dayOfWeek === parseDay(today).getDay()) : [];
    const goals = r.goals.list({ status: 'active' }, today);
    return {
      profile, week, runs, activePlan, planned, goals,
      activeWorkout: r.workouts.getActive(), activeRun: r.running.getActive(),
      daily: r.daily.get(today), counters: r.counters.listWithToday(today), latest: r.measurements.latest(),
      chart: r.analytics.weekActivity(today),
      recent: [
        ...r.workouts.history({ limit: 5 }).map((w) => ({ id: w.id, kind: 'workout' as const, title: w.name, when: w.startedAt, detail: `${formatDuration(w.durationSec)} · ${u.weight(w.totalVolumeKg, 0)} lifted` })),
        ...r.running.list({ limit: 5 }).map((x) => ({ id: x.id, kind: 'run' as const, title: RUN_ACTIVITIES.find((a) => a.id === x.activityType)?.label ?? x.activityType, when: x.startedAt, detail: `${u.distance(x.distanceM)} · ${formatDuration(x.durationSec)}` })),
      ].sort((a, b) => b.when - a.when).slice(0, 5),
      records: r.records.recent(3),
      muscles: r.analytics.muscleLoadForDay(today),
      streaks: r.analytics.streaks(today),
      weeklyTarget: r.settings.get<number>('weekly.workouts', 3),
      lastWorkout: r.workouts.history({ limit: 1 })[0] ?? null,
      cards: r.settings.get<DashboardCardId[]>('dashboard.cards', DEFAULT_CARDS),
    };
  });
  if (!data?.profile) return null;
  const { profile, cards } = data;
  const show = (id: DashboardCardId) => cards.includes(id);
  const water = data.counters.find((c) => c.builtInKey === 'water');
  const weightGoal = data.goals.find((g) => g.type === 'weight');
  const weightNow = data.latest?.weightKg ?? profile.weightKg;

  return (
    <Screen>
      <Row>
        {profile.photoUri ? <Image accessibilityLabel="Profile photo" source={{ uri: profile.photoUri }} style={{ width: 52, height: 52, borderRadius: 26 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="muted">{greeting()}</Text>
          <Text variant="h1">{profile.fullName.split(' ')[0]}</Text>
        </View>
      </Row>

      {data.activeWorkout ? <Card onPress={() => router.push('/workout/active')}><Row><Pill text="IN PROGRESS" tone="warning" /><Text variant="h2">{data.activeWorkout.name}</Text></Row><Text variant="muted">Tap to resume your workout.</Text></Card> : null}
      {data.activeRun ? <Card onPress={() => router.push('/run/track')}><Row><Pill text="IN PROGRESS" tone="warning" /><Text variant="h2">Tracked activity</Text></Row><Text variant="muted">An unfinished GPS activity was found. Tap to finish or discard it.</Text></Card> : null}

      {show('today') ? (
        <Card>
          <SectionHeader title="Today" />
          <Row style={{ justifyContent: 'space-around' }}>
            <ProgressRing value={profile.dailyStepTarget ? data.daily.steps / profile.dailyStepTarget : 0} label={String(data.daily.steps)} sub={`of ${profile.dailyStepTarget} steps`} />
            <ProgressRing value={profile.dailyWaterTargetMl ? (water?.today ?? 0) / profile.dailyWaterTargetMl : 0} label={`${Math.round(water?.today ?? 0)}`} sub={`of ${profile.dailyWaterTargetMl} ml water`} color="#4C8DFF" />
          </Row>
          <Text variant="muted">{data.daily.stepsSource === 'pedometer' ? 'Steps from your phone sensor.' : 'Steps are entered manually. Update them from the Activity tab.'}</Text>
        </Card>
      ) : null}

      {show('week') ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View><Text variant="h1">{data.streaks.current > 0 ? `🔥 ${data.streaks.current}` : '0'}<Text variant="muted">  day streak</Text></Text><Text variant="muted">Best: {data.streaks.best} day{data.streaks.best === 1 ? '' : 's'}</Text></View>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            {data.streaks.weekDays.map((d) => (
              <View key={d.date} style={{ alignItems: 'center', gap: 4 }}>
                <View accessibilityLabel={`${d.date}: ${d.active ? 'active' : d.future ? 'upcoming' : 'no activity'}`} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.active ? colors.primary : colors.surfaceAlt, borderWidth: d.date === today ? 2 : 0, borderColor: colors.primaryText, opacity: d.future ? 0.5 : 1 }} />
                <Text variant="muted">{'SMTWTFS'[parseDay(d.date).getDay()]}</Text>
              </View>
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label">Weekly goal: {data.streaks.weekWorkouts} of {data.weeklyTarget} workouts</Text>
            <Row style={{ gap: 4 }}>
              <Button title="-" variant="secondary" disabled={data.weeklyTarget <= 1} onPress={() => { repos.settings.set('weekly.workouts', data.weeklyTarget - 1); void refresh(); }} />
              <Button title="+" variant="secondary" disabled={data.weeklyTarget >= 14} onPress={() => { repos.settings.set('weekly.workouts', data.weeklyTarget + 1); void refresh(); }} />
            </Row>
          </Row>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ height: 10, width: `${Math.min(100, (data.streaks.weekWorkouts / data.weeklyTarget) * 100)}%`, backgroundColor: data.streaks.weekWorkouts >= data.weeklyTarget ? colors.success : colors.primary }} />
          </View>
          {data.streaks.weekWorkouts >= data.weeklyTarget ? <Text variant="muted">Weekly goal reached. Anything more is a bonus.</Text> : null}
          {data.lastWorkout ? (
            <Button variant="secondary" disabled={!!data.activeWorkout} title={`Repeat last workout: ${data.lastWorkout.name}`} onPress={() => {
              try { repos.workouts.repeat(data.lastWorkout!.id); void refresh(); router.push('/workout/active'); } catch (e) { notify('Cannot repeat workout', errorMessage(e)); }
            }} />
          ) : null}
        </Card>
      ) : null}

      {show('workout') ? (
        <Card>
          <SectionHeader title="Muscles trained today" />
          {Object.keys(data.muscles).length ? (
            <>
              <MuscleMap heat={data.muscles} height={230} />
              <Row style={{ flexWrap: 'wrap', gap: 6 }}>{Object.entries(data.muscles).sort((a, b) => b[1] - a[1]).map(([g, n]) => <Pill key={g} text={`${muscleNames([g])[0]} · ${n % 1 ? n.toFixed(1) : n} sets`} tone="primary" />)}</Row>
              <Text variant="muted">Darker = more completed working sets today. Secondary muscles count half.</Text>
            </>
          ) : (<><MuscleMap heat={{}} height={170} /><Text variant="muted">Nothing trained yet today. Finish a set and the muscles you worked light up here.</Text></>)}
        </Card>
      ) : null}

      {show('workout') ? (
        <Card>
          <SectionHeader title="Today's workout" />
          {data.planned.length ? (
            <>
              <Text variant="body">{data.planned[0]?.dayName ?? data.activePlan?.name} · {data.planned.length} exercises</Text>
              <Text variant="muted">{data.planned.slice(0, 4).map((p) => p.exerciseName).join(', ')}{data.planned.length > 4 ? '…' : ''}</Text>
              {!data.activeWorkout ? <Button title="Start this workout" onPress={() => router.push({ pathname: '/workout/active', params: { planId: data.activePlan!.id, day: String(parseDay(today).getDay()), name: data.planned[0]?.dayName ?? data.activePlan!.name } })} /> : null}
            </>
          ) : (
            <>
              <Text variant="muted">{data.activePlan ? 'Rest day in your plan.' : 'No plan scheduled. Start an empty workout or pick a plan.'}</Text>
              {!data.activeWorkout ? <Row><Button style={{ flex: 1 }} title="Empty workout" onPress={() => router.push('/workout/active')} /><Button style={{ flex: 1 }} variant="secondary" title="Plans" onPress={() => router.push('/plans')} /></Row> : null}
            </>
          )}
        </Card>
      ) : null}

      {show('week') ? (
        <Card>
          <SectionHeader title="This week" />
          <Row>
            <Stat label="Workouts" value={String(data.week.length)} />
            <Stat label="Time" value={formatDuration(data.week.reduce((a, w) => a + (w.durationSec ?? 0), 0))} />
            <Stat label="Distance" value={u.distance(data.runs.reduce((a, r) => a + r.distanceM, 0), 1)} />
          </Row>
          <Row>
            <Stat label="Calories (est.)" value={String(data.week.reduce((a, w) => a + (w.caloriesEstimate ?? 0), 0) + data.runs.reduce((a, r) => a + (r.caloriesEstimate ?? 0), 0))} sub="Estimated from MET values" />
          </Row>
        </Card>
      ) : null}

      {show('weight') ? (
        <Card onPress={() => router.push('/measurements')}>
          <SectionHeader title="Weight" />
          <Row>
            <Stat label="Current" value={u.weight(weightNow)} />
            <Stat label="Target" value={u.weight(profile.targetWeightKg)} />
            {weightGoal ? <ProgressRing size={64} stroke={7} value={weightGoal.progress} label={`${Math.round(weightGoal.progress * 100)}%`} /> : null}
          </Row>
          {!weightGoal && profile.targetWeightKg ? <Text variant="muted">Add a weight goal in Goals to track progress.</Text> : null}
        </Card>
      ) : null}

      {show('chart') ? (
        <Card>
          <SectionHeader title="Last 7 days" />
          <Text variant="muted">Workout minutes</Text>
          <BarChart data={data.chart.map((d) => ({ label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parseDay(d.date).getDay()]!, value: d.workoutMinutes }))} formatValue={(n) => `${n}m`} highlightLast />
          <Text variant="muted">Distance ({u.du})</Text>
          <BarChart data={data.chart.map((d) => ({ label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parseDay(d.date).getDay()]!, value: u.du === 'km' ? d.distanceM / 1000 : d.distanceM / 1609.344 }))} formatValue={(n) => n.toFixed(1)} highlightLast />
        </Card>
      ) : null}

      {show('recent') ? (
        <Card>
          <SectionHeader title="Recent activity" />
          {data.recent.length === 0 ? <EmptyState title="Nothing logged yet" body="Your workouts and runs will show up here." /> : data.recent.map((a) => (
            <Card key={a.kind + a.id} onPress={() => router.push(a.kind === 'workout' ? `/workout/${a.id}` : `/run/${a.id}`)}>
              <Text variant="body" style={{ fontWeight: '700' }}>{a.title}</Text>
              <Text variant="muted">{new Date(a.when).toLocaleDateString()} · {a.detail}</Text>
            </Card>
          ))}
        </Card>
      ) : null}

      {show('records') ? (
        <Card onPress={() => router.push('/records')}>
          <SectionHeader title="Personal records" />
          {data.records.length === 0 ? <Text variant="muted">Complete workouts to set your first records.</Text> : data.records.map((r) => (
            <Row key={r.id} style={{ justifyContent: 'space-between' }}><Text>{recordLabel(r.kind, r.subjectName)}</Text><Text variant="muted">{recordValue(r, u)}</Text></Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

