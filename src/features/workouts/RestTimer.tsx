import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Row, Text } from '@/components/ui';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration } from '@/utils/units';

/**
 * In-app rest countdown. It runs only while the app is open (it does not schedule a notification),
 * and it derives remaining time from an end timestamp, so it stays correct after the screen sleeps.
 */
export function RestTimer() {
  const { colors } = useTheme();
  const rest = useSession((s) => s.rest);
  const adjust = useSession((s) => s.adjustRest);
  const stop = useSession((s) => s.stopRest);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);
  const left = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && left === 0) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); stop(); }
  }, [left, rest, stop]);
  if (!rest) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, padding: 12, gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label">Rest</Text>
        <Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(left)}</Text>
        <Row><Button title="-15s" variant="secondary" onPress={() => adjust(-15)} /><Button title="+15s" variant="secondary" onPress={() => adjust(15)} /><Button title="Skip" variant="ghost" onPress={stop} /></Row>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.min(100, (left / rest.totalSec) * 100)}%`, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}
