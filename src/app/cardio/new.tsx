import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Chip, ChipRow, Field, Row, Screen, Text } from '@/components/ui';
import { CARDIO_ACTIVITIES, INTENSITY } from '@/constants/activities';
import { useDbMutation } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { cardioSchema, type CardioInput } from '@/types/schemas';
import { dayTimeToMs, isValidDay, localDay, nowHHMM } from '@/utils/dates';
import { displayToM } from '@/utils/units';
import { errorMessage } from '@/services/dialogs';

export default function NewCardio() {
  const router = useRouter();
  const u = useUnits();
  const [type, setType] = useState('cycling');
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(localDay());
  const [time, setTime] = useState(nowHHMM());
  const [h, setH] = useState(''); const [m, setM] = useState('');
  const [dist, setDist] = useState(''); const [hr, setHr] = useState(''); const [maxHr, setMaxHr] = useState(''); const [kcal, setKcal] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high' | null>('moderate');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const save = useDbMutation((r, v: CardioInput) => r.cardio.create(v), { onSuccess: () => router.back() });
  const n = (x: string) => (x.trim() === '' ? 0 : parseFloat(x.replace(',', '.')));
  const submit = () => {
    if (!isValidDay(date)) return setErr('Date must be YYYY-MM-DD');
    const startedAt = dayTimeToMs(date, time);
    if (startedAt == null) return setErr('Start time must be HH:MM (24 hour)');
    const p = cardioSchema.safeParse({
      activityType: type, customName: type === 'custom' ? custom : null, date, startedAt, durationSec: Math.round(n(h) * 3600 + n(m) * 60),
      distanceM: dist ? displayToM(n(dist), u.du) : null, avgHeartRate: hr ? Math.round(n(hr)) : null, maxHeartRate: maxHr ? Math.round(n(maxHr)) : null,
      intensity, caloriesEstimate: kcal ? Math.round(n(kcal)) : null, notes: notes.trim() || null,
    });
    if (!p.success) return setErr(errorMessage(p.error));
    setErr(null); save.mutate(p.data);
  };
  return (
    <Screen>
      <ChipRow>{CARDIO_ACTIVITIES.map((a) => <Chip key={a.id} label={a.label} selected={type === a.id} onPress={() => setType(a.id)} />)}</ChipRow>
      {type === 'custom' ? <Field label="Activity name" value={custom} onChangeText={setCustom} /> : null}
      <Row><Field label="Date" value={date} onChangeText={setDate} /><Field label="Start time" value={time} onChangeText={setTime} /></Row>
      <Row><Field label="Hours" value={h} onChangeText={setH} keyboardType="number-pad" /><Field label="Minutes" value={m} onChangeText={setM} keyboardType="number-pad" /></Row>
      <Field label={`Distance (${u.du}, optional)`} value={dist} onChangeText={setDist} keyboardType="decimal-pad" />
      <Row><Field label="Avg heart rate" value={hr} onChangeText={setHr} keyboardType="number-pad" /><Field label="Max heart rate" value={maxHr} onChangeText={setMaxHr} keyboardType="number-pad" /></Row>
      <Text variant="label">Intensity</Text>
      <ChipRow>{INTENSITY.map((i) => <Chip key={i} label={i[0]!.toUpperCase() + i.slice(1)} selected={intensity === i} onPress={() => setIntensity(i)} />)}</ChipRow>
      <Field label="Calories (leave empty to estimate)" value={kcal} onChangeText={setKcal} keyboardType="number-pad" hint="If empty, calories are estimated from the activity, your weight and the intensity, and labelled as an estimate." />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {err ? <Text style={{ color: '#C0262D' }} accessibilityLiveRegion="polite">{err}</Text> : null}
      <Button title="Save cardio session" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
