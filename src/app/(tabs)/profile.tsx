import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Divider, Row, Screen, Text } from '@/components/ui';
import { GOALS } from '@/constants/profile';
import { useProfile } from '@/hooks/data';
import { useUnits } from '@/hooks/units';
import { useTheme } from '@/theme/ThemeProvider';
import { ageFromDob, localDay } from '@/utils/dates';
import { bmi, bmiCategory } from '@/services/calculations';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const LINKS: { title: string; href: Href; icon: Icon }[] = [
  { title: 'Workout plans', href: '/plans', icon: 'albums-outline' },
  { title: 'Calendar', href: '/calendar', icon: 'calendar-outline' },
  { title: 'Body measurements', href: '/measurements', icon: 'body-outline' },
  { title: 'Goals', href: '/goals', icon: 'flag-outline' },
  { title: 'Personal records', href: '/records', icon: 'trophy-outline' },
  { title: 'Achievements', href: '/achievements', icon: 'ribbon-outline' },
  { title: 'Activity counters', href: '/counters', icon: 'add-circle-outline' },
  { title: 'Exercise library', href: '/exercises', icon: 'search-outline' },
  { title: 'Settings & reminders', href: '/settings', icon: 'settings-outline' },
  { title: 'Backup & restore', href: '/backup', icon: 'cloud-download-outline' },
];

export default function ProfileTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const u = useUnits();
  const { data: p } = useProfile();
  if (!p) return null;
  const b = p.weightKg && p.heightCm ? bmi(p.weightKg, p.heightCm) : null;
  return (
    <Screen>
      <Card onPress={() => router.push('/profile-edit')} accessibilityLabel="Edit profile">
        <Row style={{ gap: 16 }}>
          {p.photoUri ? <Image source={{ uri: p.photoUri }} style={{ width: 72, height: 72, borderRadius: 36 }} accessibilityIgnoresInvertColors />
            : <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={34} color={colors.textMuted} /></View>}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h2">{p.fullName}</Text>
            <Text variant="muted">{GOALS.find((g) => g.id === p.goal)?.label}{p.dateOfBirth ? ` · ${ageFromDob(p.dateOfBirth)} yrs` : ''}</Text>
            <Text variant="muted">{u.weight(p.weightKg)}{p.targetWeightKg ? ` → ${u.weight(p.targetWeightKg)}` : ''}</Text>
            {b ? <Text variant="muted">BMI {b.toFixed(1)} ({bmiCategory(b)}), calculated</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Row>
        <Text variant="muted">Member since {localDay(p.createdAt)}. All of this is stored only on this device.</Text>
      </Card>
      <Card style={{ padding: 0 }}>
        {LINKS.map((l, i) => (
          <View key={l.title}>
            {i > 0 ? <Divider /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={l.title} onPress={() => router.push(l.href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 52 }}>
              <Ionicons name={l.icon} size={22} color={colors.primary} />
              <Text style={{ flex: 1 }}>{l.title}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
