import React, { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { Button, Card, EmptyState, Field, Row, Screen, SectionHeader, Stat, Text } from '@/components/ui';
import { LineChart } from '@/components/charts/Charts';
import { measurementSchema } from '@/types/schemas';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { bmi, bmiCategory } from '@/services/calculations';
import { confirm, notify } from '@/services/dialogs';
import { displayToKg, kgToDisplay, round } from '@/utils/units';
import { localDay } from '@/utils/dates';

const FIELDS = [['chestCm', 'Chest'], ['waistCm', 'Waist'], ['hipsCm', 'Hips'], ['armsCm', 'Arms'], ['forearmsCm', 'Forearms'], ['thighsCm', 'Thighs'], ['calvesCm', 'Calves'], ['neckCm', 'Neck']] as const;

export default function Measurements() {
  const u = useUnits();
  const { data } = useDbQuery(['measurements'], (r) => ({ list: r.measurements.list({ limit: 100 }), series: r.measurements.weightSeries(), profile: r.profile.get(), change: r.analytics.weightChange() }));
  const [date, setDate] = useState(localDay());
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const num = (s: string | undefined) => (s && s.trim() ? parseFloat(s.replace(',', '.')) : null);
  const save = useDbMutation((r, v: Parameters<typeof r.measurements.create>[0]) => r.measurements.create(v), { onSuccess: () => { setWeight(''); setFat(''); setVals({}); setNotes(''); setPhoto(null); setErr(null); } });
  const del = useDbMutation((r, id: string) => r.measurements.remove(id));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Photos permission needed', 'Allow photo access to attach a progress photo. It stays on this device.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };
  const submit = () => {
    const w = num(weight);
    const p = measurementSchema.safeParse({
      date, weightKg: w == null ? null : displayToKg(w, u.wu), bodyFatPct: num(fat), photoUri: photo, notes: notes.trim() || null,
      ...Object.fromEntries(FIELDS.map(([k]) => [k, num(vals[k])])),
    });
    if (!p.success) return setErr(p.error.issues[0]?.message ?? 'Check your entries');
    setErr(null);
    save.mutate(p.data);
  };
  if (!data) return null;
  const cur = data.change.latest ?? data.profile?.weightKg ?? null;
  const b = cur && data.profile?.heightCm ? bmi(cur, data.profile.heightCm) : null;
  const target = data.profile?.targetWeightKg;
  return (
    <Screen>
      <Card>
        <Row><Stat label="Current" value={u.weight(cur)} /><Stat label="Target" value={u.weight(target)} />
          <Stat label="BMI (calculated)" value={b ? b.toFixed(1) : '-'} sub={b ? bmiCategory(b) : 'Needs height + weight'} /></Row>
        {cur && target ? <Text variant="muted">{Math.abs(round(kgToDisplay(cur - target, u.wu)))} {u.wu} {cur > target ? 'above' : 'below'} target</Text> : null}
        {data.series.length > 1 ? <LineChart data={data.series.slice(-30).map((p) => ({ label: p.date.slice(5), value: round(kgToDisplay(p.weightKg, u.wu)) }))} /> : null}
        <Text variant="muted">BMI is a screening ratio, not a diagnosis. Body fat is whatever you enter; FitTrack does not measure it.</Text>
      </Card>

      <Card>
        <SectionHeader title="Add entry" />
        <Row><View style={{ flex: 1 }}><Field label="Date" value={date} onChangeText={setDate} autoCapitalize="none" /></View><View style={{ flex: 1 }}><Field label={`Weight (${u.wu})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View></Row>
        <Field label="Body fat % (optional, manual)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
        {FIELDS.reduce<(typeof FIELDS[number])[][]>((rows, f, i) => { if (i % 2 === 0) rows.push([f]); else rows[rows.length - 1]!.push(f); return rows; }, []).map((pair) => (
          <Row key={pair[0]![0]}>{pair.map(([k, label]) => <View key={k} style={{ flex: 1 }}><Field label={`${label} (cm)`} value={vals[k] ?? ''} onChangeText={(t) => setVals((v) => ({ ...v, [k]: t }))} keyboardType="decimal-pad" /></View>)}</Row>
        ))}
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Row><Button variant="secondary" title={photo ? 'Change photo' : 'Add progress photo'} onPress={pickPhoto} />{photo ? <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 8 }} accessibilityLabel="Selected progress photo" /> : null}</Row>
        {err ? <Text style={{ color: '#E5484D' }}>{err}</Text> : null}
        <Button title="Save entry" loading={save.isPending} onPress={submit} />
      </Card>

      <SectionHeader title="History" />
      {data.list.length === 0 ? <EmptyState title="No entries yet" body="Add your first weigh-in or measurement above." /> : data.list.map((m) => (
        <Card key={m.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="h2">{m.date}</Text>
            <Button title="Delete" variant="danger" onPress={async () => { if (await confirm('Delete this entry?', 'This cannot be undone.', 'Delete', true)) del.mutate(m.id); }} />
          </Row>
          <Text variant="muted">{[m.weightKg != null && u.weight(m.weightKg), m.bodyFatPct != null && `${m.bodyFatPct}% body fat`, ...FIELDS.filter(([k]) => m[k] != null).map(([k, l]) => `${l} ${m[k]} cm`)].filter(Boolean).join(' · ')}</Text>
          {m.notes ? <Text variant="muted">{m.notes}</Text> : null}
          {m.photoUri ? <Image source={{ uri: m.photoUri }} style={{ width: 96, height: 96, borderRadius: 10 }} accessibilityLabel={`Progress photo from ${m.date}`} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
