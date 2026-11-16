import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
interface Ctx { colors: Palette; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void }
const ThemeCtx = createContext<Ctx>({ colors: dark, isDark: true, mode: 'system', setMode: () => {} });

export function ThemeProvider({ initialMode = 'system', onModeChange, children }: { initialMode?: ThemeMode; onModeChange?: (m: ThemeMode) => void; children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const setMode = useCallback((m: ThemeMode) => { setModeState(m); onModeChange?.(m); }, [onModeChange]);
  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark, mode, setMode }), [isDark, mode, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
