import React from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { useDbMutation, useProfile } from '@/hooks/data';
import type { ProfileInput } from '@/types/schemas';

export default function EditProfile() {
  const router = useRouter();
  const { data } = useProfile();
  const save = useDbMutation((r, p: ProfileInput) => r.profile.update(p), { onSuccess: () => router.back() });
  if (!data) return null;
  return <Screen><ProfileForm initial={data} submitLabel="Save changes" onSubmit={(p) => save.mutate(p)} busy={save.isPending} /></Screen>;
}
