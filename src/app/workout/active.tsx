import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, Text } from '@/components/ui';
import { SetRow } from '@/features/workouts/SetRow';
import { RestTimer } from '@/features/workouts/RestTimer';
import { useDbMutation, useDbQuery, useRepos } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { confirm, errorMessage, notify } from '@/services/dialogs';
import { useSession } from '@/stores/session';
import { formatDuration } from '@/utils/units';
import { recordLabel, recordValue } from '@/features/records/labels';
import type { DeletedExerciseSnapshot, DeletedSetSnapshot } from '@/database/repositories/workouts';
import { useInvalidateAll } from '@/hooks/data';

type Undo = { label: string; run: () => void } | null;

export default function ActiveWorkout() {
  const router = useRouter();
  const repos = useRepos();
  const u = useUnits();
  const refresh = useInvalidateAll();
  const params = useLocalSearchParams<{ planId?: string; day?: string; name?: string }>();
  const startRest = useSession((s) => s.startRest);
  const [now, setNow] = useState(Date.now());
  const [undo, setUndo] = useState<Undo>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const startedRef = useRef(false);

  const active = useDbQuery(['active-workout'], (r) => r.workouts.getActive());
  const detail = useDbQuery(['workout-detail', active.data?.id ?? ''], (r) => (active.data ? r.workouts.getDetail(active.data.id) : null));

  const begin = useDbMutation((r, a: { planId?: string; day?: number; name?: string }) => r.workouts.start({ planId: a.planId, dayOfWeek: a.day, name: a.name }));
  useEffect(() => {
    if (active.isLoading || active.data || startedRef.current) return;
    startedRef.current = true; // exactly one workout is created, even if the screen re-renders
    begin.mutate({ planId: params.planId, day: params.day != null ? Number(params.day) : undefined, name: params.name });
  }, [active.isLoading, active.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!undo) return; const id = setTimeout(() => setUndo(null), 7000); return () => clearTimeout(id); }, [undo]);

  const w = detail.data;
  const prs = useDbQuery(['prs-for', w?.exercises.map((e) => e.exerciseId).join(',') ?? ''], (r) => new Map((w?.exercises ?? []).map((e) => [e.exerciseId, r.records.forExercise(e.exerciseId)])));
  const prevMap = useDbQuery(['prev-sets', w?.id ?? '', w?.exercises.length ?? 0], (r) => new Map((w?.exercises ?? []).map((e) => [e.id, r.workouts.previousSets(e.exerciseId, w!.startedAt)])));

  /** Every write goes through here: errors are shown to the user and data is refreshed. */
  const run = <T,>(fn: () => T): T | undefined => {
    try { const v = fn(); void refresh(); return v; } catch (e) { notify('Could not save', errorMessage(e)); return undefined; }
  };

  if (!w) return <Screen><ActivityIndicator /></Screen>;
  const elapsed = Math.floor((now - w.startedAt) / 1000);

  const isPr = (exerciseId: string, tracking: string, s: { weightKg: number | null; reps: number | null; isCompleted: boolean }) => {
    if (!s.isCompleted) return false;
    const rec = prs.data?.get(exerciseId) ?? [];
    if (tracking === 'weight_reps' && s.weightKg && s.reps) return s.weightKg > (rec.find((x) => x.kind === 'max_weight')?.value ?? 0);
    if (tracking === 'bodyweight_reps' && s.reps) return s.reps > (rec.find((x) => x.kind === 'max_reps')?.value ?? 0);
    return false;
  };

  const finish = () => {
    try {
      const res = repos.workouts.finish(w.id, { rpe, notes: notes.trim() || null });
      const unlocked = repos.achievements.evaluate();
      useSession.getState().stopRest();
      const lines = [
        ...res.newRecords.map((r) => `${recordLabel(r.kind, r.subjectName)}: ${recordValue({ kind: r.kind, value: r.value, unit: r.unit }, u)}`),
        ...unlocked.map((a) => `Achievement: ${a.title}`),
      ];
      void refresh();
      if (lines.length) notify('Nice work!', lines.join('\n'));
      router.replace(`/workout/${w.id}`);
    } catch (e) { notify('Cannot finish', errorMessage(e)); }
  };

  const discard = async () => {
    if (await confirm('Discard workout?', 'All sets in this workout will be deleted.', 'Discard', true)) {
      run(() => repos.workouts.remove(w.id)); useSession.getState().stopRest(); router.back();
    }
  };
  const swap = (ei: number, dir: -1 | 1) => { const ids = w.exercises.map((x) => x.id); [ids[ei + dir], ids[ei]] = [ids[ei]!, ids[ei + dir]!]; run(() => repos.workouts.reorderExercises(w.id, ids)); };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Field label="Workout name" value={w.name} onChangeText={(t) => run(() => repos.workouts.updateMeta(w.id, { name: t }))} /></View>
          <View style={{ alignItems: 'flex-end' }}><Text variant="label">Duration</Text><Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(elapsed)}</Text></View>
        </Row>

        {w.exercises.length === 0 ? <Card><Text variant="muted">Add your first exercise to begin. Previous weights and reps are filled in automatically.</Text></Card> : null}

        {w.exercises.map((e, ei) => (
          <Card key={e.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="h2" style={{ flex: 1 }} onPress={() => router.push(`/exercises/${e.exerciseId}`)}>{e.name}</Text>
              <Row style={{ gap: 4 }}>
                <Button title="↑" variant="ghost" disabled={ei === 0} onPress={() => swap(ei, -1)} />
                <Button title="↓" variant="ghost" disabled={ei === w.exercises.length - 1} onPress={() => swap(ei, 1)} />
              </Row>
            </Row>
            <Row><Text variant="label" style={{ width: 28, textAlign: 'center' }}>Set</Text><Text variant="label" style={{ width: 62 }}>Prev</Text>
              <Text variant="label">{e.trackingType === 'weight_reps' ? `${u.wu}  ·  reps` : e.trackingType === 'assisted' ? `assist (${u.wu})  ·  reps` : e.trackingType === 'bodyweight_reps' ? 'reps' : e.trackingType === 'distance' ? 'metres  ·  seconds' : 'seconds'}</Text></Row>
            {e.sets.map((s, i) => (
              <SetRow key={s.id} set={s} index={i} tracking={e.trackingType} unit={u.wu} previous={prevMap.data?.get(e.id)?.[i]} isPr={isPr(e.exerciseId, e.trackingType, s)}
                onChange={(p) => run(() => repos.workouts.updateSet(s.id, p))}
                onToggle={() => { const done = run(() => repos.workouts.toggleSetComplete(s.id)); if (done) startRest(e.restSec); }}
                onDelete={() => { const snap = run(() => repos.workouts.deleteSet(s.id)) as DeletedSetSnapshot | undefined; if (snap) setUndo({ label: 'Set deleted', run: () => run(() => repos.workouts.restoreSet(snap)) }); }} />
            ))}
            <Row>
              <Button style={{ flex: 1 }} variant="secondary" title="+ Add set" onPress={() => run(() => repos.workouts.addSet(e.id))} />
              <Button variant="ghost" title="Duplicate" onPress={() => run(() => repos.workouts.duplicateExercise(e.id))} />
              <Button variant="ghost" title="Remove" onPress={async () => {
                if (await confirm('Remove exercise?', `${e.name} and its sets will be removed from this workout.`, 'Remove', true)) {
                  const snap = run(() => repos.workouts.removeExercise(e.id)) as DeletedExerciseSnapshot | undefined;
                  if (snap) setUndo({ label: 'Exercise removed', run: () => run(() => repos.workouts.restoreExercise(snap)) });
                }
              }} />
            </Row>
            <Row><Text variant="muted">Rest {e.restSec}s</Text>
              <Button variant="ghost" title="-15" onPress={() => run(() => repos.workouts.updateExercise(e.id, { restSec: Math.max(0, e.restSec - 15) }))} />
              <Button variant="ghost" title="+15" onPress={() => run(() => repos.workouts.updateExercise(e.id, { restSec: e.restSec + 15 }))} /></Row>
          </Card>
        ))}

        <Button title="+ Add exercise" onPress={() => router.push({ pathname: '/exercises/pick', params: { sessionId: w.id } })} />

        {finishing ? (
          <Card>
            <Text variant="h2">Finish workout</Text>
            <Text variant="label">How hard was it? (RPE 1-10)</Text>
            <ChipRow>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <Chip key={n} label={String(n)} selected={rpe === n} onPress={() => setRpe(rpe === n ? null : n)} />)}</ChipRow>
            <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
            <Text variant="muted">Sets with no values are dropped. Unchecked sets that contain values are kept but not counted in volume.</Text>
            <Row><Button style={{ flex: 1 }} title="Save workout" onPress={finish} /><Button variant="secondary" title="Back" onPress={() => setFinishing(false)} /></Row>
          </Card>
        ) : (
          <Row><Button style={{ flex: 1 }} title="Finish" onPress={() => setFinishing(true)} /><Button variant="danger" title="Discard" onPress={discard} /></Row>
        )}
      </Screen>
      {undo ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: 92 }}><Card><Row style={{ justifyContent: 'space-between' }}><Text>{undo.label}</Text><Button title="Undo" variant="ghost" onPress={() => { undo.run(); setUndo(null); }} /></Row></Card></View> : null}
      <RestTimer />
    </View>
  );
}
