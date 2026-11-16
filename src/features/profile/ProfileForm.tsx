import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Chip, ChipRow, Field, Row, Segmented, Text } from '@/components/ui';
import { ACTIVITY_LEVELS, EXPERIENCE, GENDERS, GOALS, WEEKDAYS, WORKOUT_TYPES } from '@/constants/profile';
import { profileInputSchema, type ProfileInput } from '@/types/schemas';
import { cmToFeetInches, displayToKg, kgToDisplay, round } from '@/utils/units';
import { isValidDay } from '@/utils/dates';
import type { UserProfile } from '@/database/repositories/profile';
import { useTheme } from '@/theme/ThemeProvider';

const num = (s: string): number | null => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function ProfileForm({ initial, onSubmit, submitLabel, busy }: { initial?: UserProfile; onSubmit: (p: ProfileInput) => void; submitLabel: string; busy?: boolean }) {
  const { colors } = useTheme();
  const [wu, setWu] = useState<'kg' | 'lb'>(initial?.weightUnit === 'lb' ? 'lb' : 'kg');
  const [du, setDu] = useState<'km' | 'mi'>(initial?.distanceUnit === 'mi' ? 'mi' : 'km');
  const show = (kg: number | null | undefined) => (kg == null ? '' : String(round(kgToDisplay(kg, initial?.weightUnit === 'lb' ? 'lb' : 'kg'), 1)));
  const [name, setName] = useState(initial?.fullName ?? '');
  const [photo, setPhoto] = useState(initial?.photoUri ?? null);
  const [dob, setDob] = useState(initial?.dateOfBirth ?? '');
  const [gender, setGender] = useState<string | null>(initial?.gender ?? null);
  const [height, setHeight] = useState(initial?.heightCm ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(show(initial?.weightKg));
  const [target, setTarget] = useState(show(initial?.targetWeightKg));
  const [exp, setExp] = useState(initial?.experience ?? 'beginner');
  const [goal, setGoal] = useState(initial?.goal ?? 'general_fitness');
  const [level, setLevel] = useState(initial?.activityLevel ?? 'moderate');
  const [type, setType] = useState<string | null>(initial?.preferredWorkoutType ?? null);
  const [days, setDays] = useState<number[]>(initial?.preferredWorkoutDays ?? []);
  const [steps, setSteps] = useState(String(initial?.dailyStepTarget ?? 8000));
  const [cal, setCal] = useState(initial?.dailyCalorieTarget ? String(initial.dailyCalorieTarget) : '');
  const [water, setWater] = useState(String(initial?.dailyWaterTargetMl ?? 2500));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (dob && !isValidDay(dob)) e.dob = 'Use the format YYYY-MM-DD';
    const w = num(weight), t = num(target), h = num(height);
    // The unit toggle changes what the number means, so convert from the *selected* unit.
    const candidate = {
      fullName: name, photoUri: photo, dateOfBirth: dob || null, gender: gender as ProfileInput['gender'],
      heightCm: h, weightKg: w == null ? null : displayToKg(w, wu), targetWeightKg: t == null ? null : displayToKg(t, wu),
      experience: exp, goal, activityLevel: level, preferredWorkoutType: type, preferredWorkoutDays: days,
      weightUnit: wu, distanceUnit: du, dailyStepTarget: num(steps) ?? 0, dailyCalorieTarget: cal ? num(cal) : null, dailyWaterTargetMl: num(water) ?? 0,
    };
    const parsed = profileInputSchema.safeParse(candidate);
    if (!parsed.success) for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
    setErrors(e);
    if (parsed.success && !e.dob) onSubmit(parsed.data);
  };
  const ft = height ? cmToFeetInches(num(height) ?? 0) : null;

  return (
    <View style={{ gap: 16 }}>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" onPress={pickPhoto} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 72, height: 72 }} /> : <Text variant="muted">Photo</Text>}
        </Pressable>
        <Field label="Full name" value={name} onChangeText={setName} error={errors.fullName} autoCapitalize="words" textContentType="name" />
      </Row>
      <Row><Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" error={errors.dob ?? errors.dateOfBirth} keyboardType="numbers-and-punctuation" /></Row>
      <View style={{ gap: 6 }}><Text variant="label">Gender (optional)</Text>
        <ChipRow>{GENDERS.map((g) => <Chip key={g.id} label={g.label} selected={gender === g.id} onPress={() => setGender(gender === g.id ? null : g.id)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Units</Text>
        <Segmented value={wu} onChange={setWu} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
        <Segmented value={du} onChange={setDu} options={[{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }]} /></View>
      <Row>
        <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" error={errors.heightCm} hint={ft ? `${ft.ft} ft ${ft.inch} in` : undefined} />
        <Field label={`Weight (${wu})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weightKg} />
        <Field label={`Target (${wu})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" error={errors.targetWeightKg} />
      </Row>
      <View style={{ gap: 6 }}><Text variant="label">Experience</Text><ChipRow>{EXPERIENCE.map((x) => <Chip key={x.id} label={x.label} selected={exp === x.id} onPress={() => setExp(x.id)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Fitness goal</Text><ChipRow>{GOALS.map((x) => <Chip key={x.id} label={x.label} selected={goal === x.id} onPress={() => setGoal(x.id)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Activity level</Text><ChipRow>{ACTIVITY_LEVELS.map((x) => <Chip key={x.id} label={x.label} selected={level === x.id} onPress={() => setLevel(x.id)} />)}</ChipRow>
        <Text variant="muted">{ACTIVITY_LEVELS.find((x) => x.id === level)?.hint}</Text></View>
      <View style={{ gap: 6 }}><Text variant="label">Preferred workout type</Text><ChipRow>{WORKOUT_TYPES.map((x) => <Chip key={x.id} label={x.label} selected={type === x.id} onPress={() => setType(type === x.id ? null : x.id)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Preferred workout days</Text>
        <ChipRow>{WEEKDAYS.map((d, i) => <Chip key={d} label={d} selected={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())} />)}</ChipRow></View>
      <Row>
        <Field label="Daily steps" value={steps} onChangeText={setSteps} keyboardType="number-pad" error={errors.dailyStepTarget} />
        <Field label="Calories (kcal)" value={cal} onChangeText={setCal} keyboardType="number-pad" error={errors.dailyCalorieTarget} />
        <Field label="Water (ml)" value={water} onChangeText={setWater} keyboardType="number-pad" error={errors.dailyWaterTargetMl} />
      </Row>
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </View>
  );
}
