import React from 'react';
import { useRouter } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { ExerciseList } from '@/features/workouts/ExerciseList';

export default function Library() {
  const router = useRouter();
  return (
    <Screen>
      <Button title="+ Create custom exercise" variant="secondary" onPress={() => router.push('/exercises/new')} />
      <ExerciseList onSelect={(e) => router.push(`/exercises/${e.id}`)} />
    </Screen>
  );
}
