import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Pill, Row, Screen, Text } from '@/components/ui';
import { useDbQuery, useRepos } from '@/hooks/data';
import { useTheme } from '@/theme/ThemeProvider';
import { localDay } from '@/utils/dates';

export default function Achievements() {
  const { colors } = useTheme();
  const repos = useRepos();
  useEffect(() => { repos.achievements.evaluate(); }, [repos]);
  const { data } = useDbQuery(['achievements'], (r) => { r.achievements.evaluate(); return r.achievements.list(); });
  if (!data) return null;
  const done = data.filter((a) => a.unlockedAt).length;
  return (
    <Screen>
      <Text variant="muted">{done} of {data.length} earned. Each badge states its exact rule and is computed from your recorded data; deleting data can remove a badge.</Text>
      {data.map((a) => (
        <Card key={a.key} style={{ opacity: a.unlockedAt ? 1 : 0.8 }}>
          <Row style={{ gap: 14 }}>
            <Ionicons name={(a.unlockedAt ? a.icon : 'lock-closed-outline') as never} size={30} color={a.unlockedAt ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h2">{a.title}</Text>
              <Text variant="muted">{a.rule}</Text>
              {!a.unlockedAt && a.progress ? <Text variant="muted">Progress: {Math.round(a.progress[0] * 10) / 10} / {Math.round(a.progress[1])}</Text> : null}
            </View>
            {a.unlockedAt ? <Pill tone="success" text={localDay(a.unlockedAt)} /> : null}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
