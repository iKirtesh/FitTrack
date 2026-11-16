import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, ChipRow, Field, Screen, Text } from '@/components/ui';
import { DIFFICULTY, EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_GROUPS, TRACKING_LABEL, TRACKING_TYPES } from '@/constants/exercise';
import { useDbMutation } from '@/hooks/data';
import { customExerciseSchema, type CustomExerciseInput } from '@/types/schemas';
import { errorMessage } from '@/services/dialogs';

export default function NewExercise() {
  const router = useRouter();
  const [f, setF] = useState<CustomExerciseInput>({ name: '', muscleGroupId: 'chest', secondaryMuscles: [], equipment: 'dumbbells', instructions: '', difficulty: 'intermediate', trackingType: 'weight_reps' });
  const [err, setErr] = useState<string | null>(null);
  const create = useDbMutation((r, x: CustomExerciseInput) => r.exercises.createCustom(x), { onSuccess: () => router.back() });
  const set = <K extends keyof CustomExerciseInput>(k: K, v: CustomExerciseInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    const p = customExerciseSchema.safeParse(f);
    if (!p.success) return setErr(errorMessage(p.error));
    setErr(null); create.mutate(p.data);
  };
  return (
    <Screen>
      <Field label="Name" value={f.name} onChangeText={(t) => set('name', t)} error={err} autoCapitalize="words" />
      <View style={{ gap: 6 }}><Text variant="label">Primary muscle</Text><ChipRow>{MUSCLE_GROUPS.map((m) => <Chip key={m.id} label={m.name} selected={f.muscleGroupId === m.id} onPress={() => set('muscleGroupId', m.id)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Secondary muscles</Text><ChipRow>{MUSCLE_GROUPS.filter((m) => m.id !== f.muscleGroupId).map((m) => <Chip key={m.id} label={m.name} selected={f.secondaryMuscles.includes(m.id)} onPress={() => set('secondaryMuscles', f.secondaryMuscles.includes(m.id) ? f.secondaryMuscles.filter((x) => x !== m.id) : [...f.secondaryMuscles, m.id])} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Equipment</Text><ChipRow>{EQUIPMENT.map((q) => <Chip key={q} label={EQUIPMENT_LABEL[q]} selected={f.equipment === q} onPress={() => set('equipment', q)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">How you track it</Text><ChipRow>{TRACKING_TYPES.map((t) => <Chip key={t} label={TRACKING_LABEL[t]} selected={f.trackingType === t} onPress={() => set('trackingType', t)} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><Text variant="label">Difficulty</Text><ChipRow>{DIFFICULTY.map((d) => <Chip key={d} label={d[0]!.toUpperCase() + d.slice(1)} selected={f.difficulty === d} onPress={() => set('difficulty', d)} />)}</ChipRow></View>
      <Field label="Instructions (optional)" value={f.instructions ?? ''} onChangeText={(t) => set('instructions', t)} multiline />
      <Button title="Save exercise" onPress={submit} loading={create.isPending} />
    </Screen>
  );
}
