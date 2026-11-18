import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/hooks/data';
import { useAutoHealthSync } from '@/features/health/sync';
import { useTheme } from '@/theme/ThemeProvider';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const tab = (name: string, title: string, icon: Icon, focused: Icon) => ({ name, title, icon, focused });
const TABS = [
  tab('index', 'Home', 'home-outline', 'home'),
  tab('workouts', 'Workouts', 'barbell-outline', 'barbell'),
  tab('activity', 'Activity', 'walk-outline', 'walk'),
  tab('progress', 'Progress', 'stats-chart-outline', 'stats-chart'),
  tab('profile', 'Profile', 'person-outline', 'person'),
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900; // web / tablets get a side rail instead of a bottom bar
  const profile = useProfile();
  useAutoHealthSync();
  // A cached "no profile" must not redirect while a refetch is still in flight (e.g. just after onboarding).
  if (profile.isLoading || (profile.isFetching && !profile.data)) return null;
  if (!profile.data) return <Redirect href="/onboarding" />;
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '700' },
      tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: { backgroundColor: colors.surface, borderColor: colors.border },
      tabBarPosition: wide ? 'left' : 'bottom', tabBarVariant: wide ? 'material' : 'uikit', sceneStyle: { backgroundColor: colors.bg },
    }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? t.focused : t.icon} size={size} color={String(color)} />, tabBarAccessibilityLabel: t.title }} />
      ))}
    </Tabs>
  );
}
