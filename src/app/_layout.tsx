import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@/hooks/data';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AppLock } from '@/features/settings/AppLock';

function Shell() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.bg }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Welcome to FitTrack', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="workout/active" options={{ title: 'Workout', gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout details' }} />
        <Stack.Screen name="exercises/index" options={{ title: 'Exercise library' }} />
        <Stack.Screen name="exercises/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="exercises/new" options={{ title: 'Custom exercise', presentation: 'modal' }} />
        <Stack.Screen name="exercises/pick" options={{ title: 'Add exercise', presentation: 'modal' }} />
        <Stack.Screen name="run/track" options={{ title: 'Run tracker', gestureEnabled: false }} />
        <Stack.Screen name="run/manual" options={{ title: 'Log run or walk', presentation: 'modal' }} />
        <Stack.Screen name="run/[id]" options={{ title: 'Activity' }} />
        <Stack.Screen name="cardio/new" options={{ title: 'Log cardio', presentation: 'modal' }} />
        <Stack.Screen name="counters" options={{ title: 'Activity counters' }} />
        <Stack.Screen name="plans/index" options={{ title: 'Workout plans' }} />
        <Stack.Screen name="plans/[id]" options={{ title: 'Plan' }} />
        <Stack.Screen name="measurements" options={{ title: 'Body measurements' }} />
        <Stack.Screen name="records" options={{ title: 'Personal records' }} />
        <Stack.Screen name="achievements" options={{ title: 'Achievements' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="goals" options={{ title: 'Goals' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="backup" options={{ title: 'Backup & restore' }} />
        <Stack.Screen name="profile-edit" options={{ title: 'Edit profile' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DatabaseProvider>
          {(repos) => (
            <ThemeProvider initialMode={repos.settings.get('theme', 'system' as 'system' | 'light' | 'dark')} onModeChange={(m) => repos.settings.set('theme', m)}>
              <AppLock><Shell /></AppLock>
            </ThemeProvider>
          )}
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
