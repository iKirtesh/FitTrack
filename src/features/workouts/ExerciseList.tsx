import React, { useState } from 'react';
import { View } from 'react-native';
import { MuscleMap, muscleNames } from '@/components/MuscleMap';
import { Button, Card, Chip, ChipRow, EmptyState, Field, Pill, Row, Text } from '@/components/ui';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_GROUPS, TRACKING_LABEL, type Equipment, type TrackingType } from '@/constants/exercise';
import { useDbQuery } from '@/hooks/data';
import type { Exercise } from '@/database/repositories/exercises';

/** Searchable, filterable exercise list shared by the library and the "add exercise" picker. */
export function ExerciseList({ onSelect, previewFirst = false }: { onSelect: (e: Exercise) => void; /** Tapping a row first shows its body diagram with an Add button instead of selecting straight away. */ previewFirst?: boolean }) {
  const [picked, setPicked] = useState<Exercise | null>(null);
  const sec = (e: Exercise): string[] => e.secondaryMuscles;
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | undefined>();
  const [equip, setEquip] = useState<string | undefined>();
  const { data } = useDbQuery(['exercises', search, muscle ?? '', equip ?? ''], (r) => r.exercises.list({ search, muscleGroupId: muscle, equipment: equip }));
  return (
    <View style={{ gap: 12 }}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Bench press, squat…" autoCorrect={false} />
      <ChipRow>{MUSCLE_GROUPS.map((m) => <Chip key={m.id} label={m.name} selected={muscle === m.id} onPress={() => setMuscle(muscle === m.id ? undefined : m.id)} />)}</ChipRow>
      <ChipRow>{EQUIPMENT.map((q) => <Chip key={q} label={EQUIPMENT_LABEL[q as Equipment]} selected={equip === q} onPress={() => setEquip(equip === q ? undefined : q)} />)}</ChipRow>
      {picked ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}><Text variant="h2" style={{ flex: 1 }}>{picked.name}</Text><Pill text="SELECTED" tone="primary" /></Row>
          <MuscleMap primary={picked.muscleGroupId} secondary={sec(picked)} height={240} />
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            <Pill text={`Primary: ${muscleNames([picked.muscleGroupId])[0]}`} tone="primary" />
            {sec(picked).map((s) => <Pill key={s} text={`Also: ${muscleNames([s])[0]}`} tone="muted" />)}
          </Row>
          <Button title={`Add ${picked.name}`} onPress={() => onSelect(picked)} />
        </Card>
      ) : muscle ? (
        <Card><MuscleMap primary={muscle} height={200} /><Text variant="muted" style={{ textAlign: 'center' }}>Showing: {muscleNames([muscle])[0]}</Text></Card>
      ) : null}
      <Text variant="muted">{data?.length ?? 0} exercises</Text>
      {data && data.length === 0 ? <EmptyState title="No exercises found" body="Try a different search or filter, or create a custom exercise." /> : null}
      {(data ?? []).map((e) => (
        <Card key={e.id} onPress={() => (previewFirst ? setPicked(e) : onSelect(e))} accessibilityLabel={e.name}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 44 }}><MuscleMap primary={e.muscleGroupId} secondary={sec(e)} view="auto" height={78} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', flex: 1 }}>{e.name}</Text>{e.isCustom ? <Pill text="CUSTOM" tone="primary" /> : null}</Row>
              <Text variant="muted">{MUSCLE_GROUPS.find((m) => m.id === e.muscleGroupId)?.name} · {EQUIPMENT_LABEL[e.equipment as Equipment]} · {TRACKING_LABEL[e.trackingType as TrackingType]}</Text>
            </View>
          </Row>
        </Card>
      ))}
    </View>
  );
}
