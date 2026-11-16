import { create } from 'zustand';

/**
 * Ephemeral UI state only. Anything the user would be upset to lose lives in SQLite
 * (the active workout is checkpointed there on every change).
 */
interface RestTimer { endsAt: number; totalSec: number }
interface SessionState {
  rest: RestTimer | null;
  startRest: (sec: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
  lastDeletedSet: { workoutId: string; snapshot: unknown } | null;
  setLastDeletedSet: (v: SessionState['lastDeletedSet']) => void;
}

export const useSession = create<SessionState>((set, get) => ({
  rest: null,
  startRest: (sec) => set({ rest: sec > 0 ? { endsAt: Date.now() + sec * 1000, totalSec: sec } : null }),
  adjustRest: (d) => { const r = get().rest; if (r) set({ rest: { endsAt: r.endsAt + d * 1000, totalSec: Math.max(1, r.totalSec + d) } }); },
  stopRest: () => set({ rest: null }),
  lastDeletedSet: null,
  setLastDeletedSet: (v) => set({ lastDeletedSet: v }),
}));
