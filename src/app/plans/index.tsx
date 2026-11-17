import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ChipRow, Chip, EmptyState, Field, Pill, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { PLAN_TEMPLATES } from '@/constants/plans';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { confirm } from '@/services/dialogs';

export default function Plans() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const { data } = useDbQuery(['plans'], (r) => r.plans.list());
  const fromTpl = useDbMutation((r, id: string) => r.plans.createFromTemplate(id), { onSuccess: (p) => router.push(`/plans/${p.id}`) });
  const blank = useDbMutation((r, n: string) => r.plans.create({ name: n }), { onSuccess: (p) => { setName(''); router.push(`/plans/${p.id}`); } });
  const dup = useDbMutation((r, id: string) => r.plans.duplicate(id));
  const active = useDbMutation((r, a: { id: string; on: boolean }) => r.plans.setActive(a.id, a.on));
  const del = useDbMutation((r, id: string) => r.plans.remove(id));
  return (
    <Screen>
      <Card>
        <SectionHeader title="Start from a template" />
        <ChipRow>{PLAN_TEMPLATES.map((t) => <Chip key={t.id} label={t.name} onPress={() => fromTpl.mutate(t.id)} />)}</ChipRow>
        <Text variant="muted">Templates use exercises from the library. You can edit everything afterwards.</Text>
        <Field label="Or create an empty plan" value={name} onChangeText={setName} placeholder="My custom plan" />
        <Button title="Create plan" disabled={!name.trim()} onPress={() => blank.mutate(name)} />
      </Card>
      {data && data.length === 0 ? <EmptyState title="No plans yet" body="Pick a template above or build your own. Set one plan active to see it on your calendar." /> : null}
      {(data ?? []).map((p) => (
        <Card key={p.id}>
          {/* Only the title area is pressable: nested buttons inside a pressable card also trigger the card on web. */}
          <Pressable accessibilityRole="button" accessibilityLabel={`Open plan ${p.name}`} onPress={() => router.push(`/plans/${p.id}`)} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}><Text variant="h2" style={{ flex: 1 }}>{p.name}</Text>{p.isActive ? <Pill tone="success" text="ACTIVE" /> : null}</Row>
            <Text variant="muted">{p.exerciseCount} exercises{p.description ? ` · ${p.description}` : ''}</Text>
          </Pressable>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title={p.isActive ? 'Deactivate' : 'Set active'} variant="secondary" onPress={() => active.mutate({ id: p.id, on: !p.isActive })} />
            <Button title="Duplicate" variant="secondary" onPress={() => dup.mutate(p.id)} />
            <Button title="Delete" variant="danger" onPress={async () => { if (await confirm(`Delete "${p.name}"?`, 'Past workouts that used this plan are kept.', 'Delete', true)) del.mutate(p.id); }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
