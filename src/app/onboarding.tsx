import React from 'react';
import { useRouter } from 'expo-router';
import { Screen, Text } from '@/components/ui';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { useDbMutation } from '@/hooks/data';
import type { ProfileInput } from '@/types/schemas';

export default function Onboarding() {
  const router = useRouter();
  const create = useDbMutation((r, p: ProfileInput) => r.profile.create(p), { onSuccess: () => router.replace('/') });
  return (
    <Screen>
      <Text variant="h1">Set up your profile</Text>
      <Text variant="muted">Everything you enter stays on this device. There is no account, no cloud and no sign-in. You can change any of it later.</Text>
      <ProfileForm submitLabel="Start tracking" onSubmit={(p) => create.mutate(p)} busy={create.isPending} />
    </Screen>
  );
}
