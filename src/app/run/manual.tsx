import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, ChipRow, Field, Row, Screen, Text } from '@/components/ui';
import { RUN_ACTIVITIES } from '@/constants/activities';
import { useDbMutation } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { dayTimeToMs, isValidDay, localDay, nowHHMM } from '@/utils/dates';
import { displayToM } from '@/utils/units';
import { manualRunSchema, type ManualRunInput } from '@/types/schemas';
import { errorMessage } from '@/services/dialogs';

export default function ManualRun() {
  const router = useRouter();
  const u = useUnits();
  const [type, setType] = useState<(typeof RUN_ACTIVITIES)[number]['id']>('outdoor_run');
  const [date, setDate] = useState(localDay());
  const [time, setTime] = useState(nowHHMM());
  const [dist, setDist] = useState('');
  const [h, setH] = useState(''); const [m, setM] = useState(''); const [s, setS] = useState('');
  const [elev, setElev] = useState(''); const [steps, setSteps] = useState(''); const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const save = useDbMutation((r, v: ManualRunInput) => r.running.createManual(v), { onSuccess: ({ session }) => router.replace(`/run/${session.id}`) });
  const num = (x: string) => (x.trim() === '' ? 0 : parseFloat(x.replace(',', '.')));

  const submit = () => {
    if (!isValidDay(date)) return setErr('Date must be YYYY-MM-DD');
    const startedAt = dayTimeToMs(date, time);
    if (startedAt == null) return setErr('Start time must be HH:MM (24 hour)');
    const p = manualRunSchema.safeParse({
      activityType: type, date, startedAt, durationSec: Math.round(num(h) * 3600 + num(m) * 60 + num(s)),
      distanceM: displayToM(num(dist), u.du), elevationGainM: elev ? num(elev) : null, steps: steps ? Math.round(num(steps)) : null, notes: notes.trim() || null,
    });
    if (!p.success) return setErr(errorMessage(p.error));
    setErr(null); save.mutate(p.data);
  };
  return (
    <Screen>
      <Text variant="muted">Enter an activity you did without GPS tracking. It is saved as a manual entry with no route.</Text>
      <ChipRow>{RUN_ACTIVITIES.map((a) => <Chip key={a.id} label={a.label} selected={type === a.id} onPress={() => setType(a.id)} />)}</ChipRow>
      <Row><Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><Field label="Start time" value={time} onChangeText={setTime} placeholder="HH:MM" /></Row>
      <Field label={`Distance (${u.du})`} value={dist} onChangeText={setDist} keyboardType="decimal-pad" />
      <Row><Field label="Hours" value={h} onChangeText={setH} keyboardType="number-pad" /><Field label="Minutes" value={m} onChangeText={setM} keyboardType="number-pad" /><Field label="Seconds" value={s} onChangeText={setS} keyboardType="number-pad" /></Row>
      <Row><Field label="Elevation gain (m)" value={elev} onChangeText={setElev} keyboardType="decimal-pad" /><Field label="Steps" value={steps} onChangeText={setSteps} keyboardType="number-pad" /></Row>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {err ? <Text style={{ color: '#C0262D' }} accessibilityLiveRegion="polite">{err}</Text> : null}
      <View><Button title="Save activity" onPress={submit} loading={save.isPending} /></View>
    </Screen>
  );
}
