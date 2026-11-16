import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { ExerciseList } from '@/features/workouts/ExerciseList';
import { useInvalidateAll, useRepos } from '@/hooks/data';
import { errorMessage, notify } from '@/services/dialogs';

/** Used for both workouts (`sessionId`) and plans (`planId` + `day`, handled by the plan editor via `onPick` storage). */
export default function PickExercise() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const router = useRouter();
  const repos = useRepos();
  const refresh = useInvalidateAll();
  return (
    <Screen>
      <Button title="+ Create custom exercise" variant="secondary" onPress={() => router.push('/exercises/new')} />
      <ExerciseList onSelect={(e) => {
        try { if (sessionId) repos.workouts.addExercise(sessionId, e.id); void refresh(); router.back(); } catch (err) { notify('Could not add', errorMessage(err)); }
      }} />
    </Screen>
  );
}
