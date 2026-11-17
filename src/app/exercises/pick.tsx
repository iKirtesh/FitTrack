import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { ExerciseList } from '@/features/workouts/ExerciseList';
import { useInvalidateAll, useRepos } from '@/hooks/data';
import { errorMessage, notify } from '@/services/dialogs';

/** Used for both workouts (`sessionId`) and plans (`planId` + `day`, handled by the plan editor via `onPick` storage). */
export default function PickExercise() {
  const { sessionId, planId, day } = useLocalSearchParams<{ sessionId?: string; planId?: string; day?: string }>();
  const router = useRouter();
  const repos = useRepos();
  const refresh = useInvalidateAll();
  return (
    <Screen>
      <Button title="+ Create custom exercise" variant="secondary" onPress={() => router.push('/exercises/new')} />
      <ExerciseList onSelect={(e) => {
        try {
          if (sessionId) repos.workouts.addExercise(sessionId, e.id);
          else if (planId) {
            const dow = day === undefined || day === '' ? null : Number(day);
            const cur = repos.plans.get(planId).items.map((i) => ({ dayOfWeek: i.dayOfWeek, dayName: i.dayName, exerciseId: i.exerciseId, targetSets: i.targetSets, targetReps: i.targetReps, targetWeightKg: i.targetWeightKg, targetDurationSec: i.targetDurationSec, targetDistanceM: i.targetDistanceM, restSec: i.restSec }));
            const sameDay = cur.find((i) => i.dayOfWeek === dow);
            repos.plans.setItems(planId, [...cur, { dayOfWeek: dow, dayName: sameDay?.dayName ?? null, exerciseId: e.id, targetSets: 3, targetReps: e.trackingType === 'timed' || e.trackingType === 'duration' ? null : 10, restSec: 90 }]);
          }
          void refresh(); router.back(); } catch (err) { notify('Could not add', errorMessage(err)); }
      }} />
    </Screen>
  );
}
