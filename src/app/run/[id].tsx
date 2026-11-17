import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, Pill, Row, Screen, Stat, Text } from '@/components/ui';
import { RouteView } from '@/components/charts/Charts';
import { RUN_ACTIVITIES } from '@/constants/activities';
import { useDbMutation, useDbQuery } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { confirm } from '@/services/dialogs';
import { formatDuration, mToDisplay } from '@/utils/units';

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const u = useUnits();
  const { data } = useDbQuery(['run', id], (r) => r.running.detail(id));
  const del = useDbMutation((r, rid: string) => r.running.remove(rid), { onSuccess: () => router.back() });
  if (!data) return null;
  const s = data.session;
  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}><Text variant="h2">{RUN_ACTIVITIES.find((a) => a.id === s.activityType)?.label ?? s.activityType}</Text><Pill tone={s.source === 'gps' ? 'primary' : 'muted'} text={s.source === 'gps' ? 'GPS' : 'MANUAL'} /></Row>
        <Text variant="muted">{s.date}</Text>
        <Row><Stat label="Distance" value={u.distance(s.distanceM)} /><Stat label="Time" value={formatDuration(s.durationSec)} /><Stat label="Avg pace" value={u.pace(s.avgPaceSecPerKm)} /></Row>
        <Row><Stat label="Fastest km" value={u.pace(s.fastestPaceSecPerKm)} /><Stat label="Elevation" value={s.elevationGainM != null ? `${Math.round(s.elevationGainM)} m` : '-'} /><Stat label="Calories" value={s.caloriesEstimate ? `~${s.caloriesEstimate}` : '-'} sub="estimate (MET)" /></Row>
        {s.steps != null ? <Text variant="muted">Steps: {s.steps}</Text> : null}
        {s.notes ? <Text variant="muted">{s.notes}</Text> : null}
      </Card>
      {data.route.length > 1 ? <RouteView points={data.route} /> : s.source === 'gps' ? <Text variant="muted">No route points were recorded for this activity.</Text> : null}
      {data.splits.length ? (
        <Card>
          <Text variant="h2">Splits</Text>
          {data.splits.map((sp, i) => (
            <View key={sp.id}>{i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text>{u.du === 'km' ? `Km ${sp.splitIndex}` : `Split ${sp.splitIndex}`}{Math.abs(sp.distanceM - 1000) > 1 ? ` (${mToDisplay(sp.distanceM, u.du).toFixed(2)} ${u.du})` : ''}</Text>
                <Text>{u.pace(sp.paceSecPerKm)}</Text>
              </Row></View>
          ))}
          <Text variant="muted">Splits are per kilometre, interpolated between recorded GPS fixes.</Text>
        </Card>
      ) : null}
      <Button title="Delete activity" variant="danger" onPress={async () => { if (await confirm('Delete this activity?', 'Its route and splits are deleted too.', 'Delete', true)) del.mutate(s.id); }} />
    </Screen>
  );
}
