import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { recordLabel, recordValue } from '@/features/records/labels';
import { useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';

export default function Records() {
  const router = useRouter();
  const u = useUnits();
  const { data } = useDbQuery(['records'], (r) => r.records.list());
  if (!data) return null;
  if (!data.length) return <Screen><EmptyState title="No personal records yet" body="Records are detected from sets you complete in finished workouts and from your logged runs. Nothing is estimated except the labelled 1RM." /></Screen>;
  return (
    <Screen>
      <Text variant="muted">Every record is calculated from your recorded data. Estimated 1RM uses the Epley formula and is only shown for sets of 12 reps or fewer.</Text>
      {data.map((r) => (
        <Card key={r.id} onPress={() => (r.sourceType === 'workout_session' && r.sourceId ? router.push(`/workout/${r.sourceId}`) : r.sourceType === 'running_session' && r.sourceId ? router.push(`/run/${r.sourceId}`) : undefined)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text>{recordLabel(r.kind, r.subjectName)}</Text><Text variant="muted">{r.date}</Text></View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}><Text variant="h2">{recordValue(r, u)}</Text>{r.kind === 'est_1rm' ? <Pill text="estimated" /> : null}</View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
