import React, { useState } from 'react';
import { View } from 'react-native';
import { Card, Chip, ChipRow, EmptyState, Field, Pill, Row, Text } from '@/components/ui';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_GROUPS, TRACKING_LABEL, type Equipment, type TrackingType } from '@/constants/exercise';
import { useDbQuery } from '@/hooks/data';
import type { Exercise } from '@/database/repositories/exercises';

/** Searchable, filterable exercise list shared by the library and the "add exercise" picker. */
export function ExerciseList({ onSelect }: { onSelect: (e: Exercise) => void }) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | undefined>();
  const [equip, setEquip] = useState<string | undefined>();
  const { data } = useDbQuery(['exercises', search, muscle ?? '', equip ?? ''], (r) => r.exercises.list({ search, muscleGroupId: muscle, equipment: equip }));
  return (
    <View style={{ gap: 12 }}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Bench press, squat…" autoCorrect={false} />
      <ChipRow>{MUSCLE_GROUPS.map((m) => <Chip key={m.id} label={m.name} selected={muscle === m.id} onPress={() => setMuscle(muscle === m.id ? undefined : m.id)} />)}</ChipRow>
      <ChipRow>{EQUIPMENT.map((q) => <Chip key={q} label={EQUIPMENT_LABEL[q as Equipment]} selected={equip === q} onPress={() => setEquip(equip === q ? undefined : q)} />)}</ChipRow>
      <Text variant="muted">{data?.length ?? 0} exercises</Text>
      {data && data.length === 0 ? <EmptyState title="No exercises found" body="Try a different search or filter, or create a custom exercise." /> : null}
      {(data ?? []).map((e) => (
        <Card key={e.id} onPress={() => onSelect(e)} accessibilityLabel={e.name}>
          <Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', flex: 1 }}>{e.name}</Text>{e.isCustom ? <Pill text="CUSTOM" tone="primary" /> : null}</Row>
          <Text variant="muted">{MUSCLE_GROUPS.find((m) => m.id === e.muscleGroupId)?.name} · {EQUIPMENT_LABEL[e.equipment as Equipment]} · {TRACKING_LABEL[e.trackingType as TrackingType]}</Text>
        </Card>
      ))}
    </View>
  );
}
