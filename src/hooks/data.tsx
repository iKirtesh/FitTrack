import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { initDatabase } from '@/database/client';
import { profileRepo, settingsRepo } from '@/database/repositories/profile';
import { exercisesRepo } from '@/database/repositories/exercises';
import { workoutsRepo } from '@/database/repositories/workouts';
import { runningRepo } from '@/database/repositories/running';
import { cardioRepo } from '@/database/repositories/cardio';
import { countersRepo, dailyActivityRepo } from '@/database/repositories/counters';
import { measurementsRepo } from '@/database/repositories/measurements';
import { plansRepo } from '@/database/repositories/plans';
import { recordsRepo } from '@/database/repositories/records';
import { achievementsRepo } from '@/database/repositories/achievements';
import { goalsRepo } from '@/database/repositories/goals';
import { analyticsRepo } from '@/database/repositories/analytics';
import { remindersRepo } from '@/database/repositories/reminders';
import { Button, Text } from '@/components/ui';
import { errorMessage, notify } from '@/services/dialogs';
import type { AppDb } from '@/types/db';

export function makeRepos(db: AppDb) {
  return {
    db,
    profile: profileRepo(db), settings: settingsRepo(db), exercises: exercisesRepo(db), workouts: workoutsRepo(db),
    running: runningRepo(db), cardio: cardioRepo(db), counters: countersRepo(db), daily: dailyActivityRepo(db),
    measurements: measurementsRepo(db), plans: plansRepo(db), records: recordsRepo(db), achievements: achievementsRepo(db),
    goals: goalsRepo(db), analytics: analyticsRepo(db), reminders: remindersRepo(db),
  };
}
export type Repos = ReturnType<typeof makeRepos>;

const ReposCtx = createContext<Repos | null>(null);
export const useRepos = (): Repos => {
  const r = useContext(ReposCtx);
  if (!r) throw new Error('useRepos outside DatabaseProvider');
  return r;
};

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false, refetchOnWindowFocus: false } } });

/**
 * Opens the database and applies migrations before rendering anything that needs data.
 * A failure is shown with a retry button instead of letting the app run on an unmigrated schema.
 */
export function DatabaseProvider({ children }: { children: (repos: Repos) => React.ReactNode }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: AppDb }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    initDatabase().then((db) => alive && setState({ status: 'ready', db }), (e) => alive && setState({ status: 'error', message: errorMessage(e) }));
    return () => { alive = false; };
  }, [attempt]);
  const repos = useMemo(() => (state.status === 'ready' ? makeRepos(state.db) : null), [state]);

  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#0B0F14' }}>
        <Text variant="h2" style={{ color: '#fff' }}>FitTrack could not open its database</Text>
        <Text variant="muted" style={{ color: '#9AA7B8' }}>Your data has not been changed or deleted. {state.message}</Text>
        <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }
  if (!repos) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F14' }}><ActivityIndicator color="#2FD39B" /></View>;
  return (
    <QueryClientProvider client={queryClient}>
      <ReposCtx.Provider value={repos}>{children(repos)}</ReposCtx.Provider>
    </QueryClientProvider>
  );
}

/** Runs a synchronous repository read as a query. Any mutation invalidates every query (cheap: local SQLite). */
export function useDbQuery<T>(key: unknown[], read: (r: Repos) => T) {
  const repos = useRepos();
  return useQuery({ queryKey: key, queryFn: () => read(repos) });
}

/** Wraps a write: shows validation/DB errors to the user and refreshes all data on success. */
export function useDbMutation<A, R = void>(run: (r: Repos, arg: A) => R, opts: { onSuccess?: (result: R) => void; silent?: boolean } = {}) {
  const repos = useRepos();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: A) => run(repos, arg),
    onSuccess: (res) => { void qc.invalidateQueries(); opts.onSuccess?.(res); },
    onError: (e) => { if (!opts.silent) notify('Could not save', errorMessage(e)); },
  });
}

export const useProfile = () => useDbQuery(['profile'], (r) => r.profile.get());
export const useInvalidateAll = () => { const qc = useQueryClient(); return () => qc.invalidateQueries(); };
