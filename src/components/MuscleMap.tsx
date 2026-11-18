import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { MUSCLE_GROUPS } from '@/constants/exercise';
import { useTheme } from '@/theme/ThemeProvider';

/** Drawing regions. An exercise's muscle-group ids are expanded onto these. */
const EXPAND: Record<string, string[]> = {
  chest: ['chest'], back: ['back'], shoulders: ['shoulders'], biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'], quadriceps: ['quadriceps'], hamstrings: ['hamstrings'], glutes: ['glutes'], calves: ['calves'],
  abs: ['abs'], core: ['abs', 'core'],
  full_body: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'core'],
};
const BACK_GROUPS = new Set(['back', 'triceps', 'hamstrings', 'glutes']);
const FRONT_REGIONS = new Set(['chest', 'abs', 'core', 'biceps', 'quadriceps']);

/**
 * Original body illustration (not copied from any app or atlas). Every path below describes the figure's
 * RIGHT half in a 100 x 190 box with the spine at x = 50; the left half is the mirror image.
 */
const SILHOUETTE = [
  'M50 28 L60 28 Q70 29 74 36 L70 62 Q68 76 67 90 L50 90 Z', // torso
  'M50 90 L67 90 Q70 110 66 134 Q66 152 63 172 L64 184 L51 184 Q51 170 52 150 Q50 120 50 90 Z', // leg
  'M73 34 Q80 36 81 46 L83 70 Q86 84 85 98 L88 108 Q86 112 82 110 L78 100 Q74 84 72 72 Q70 56 71 44 Z', // arm
];
const FRONT: [string, string][] = [
  ['shoulders', 'M62 33 Q71 31 75 38 Q77 46 73 52 Q68 48 65 42 Z'],
  ['chest', 'M51 37 Q58 35 65 40 Q66 49 60 54 Q54 55 51 52 Z'],
  ['abs', 'M51.5 56 h6.5 v6 h-6.5 Z M51.5 63.5 h6.5 v6 h-6.5 Z M51.5 71 h6.5 v6 h-6.5 Z M51.5 78.5 h6.5 v6 h-6.5 Z'],
  ['core', 'M60 56 Q65 58 66 66 Q66 76 63 86 Q60 80 59.5 72 Z'],
  ['biceps', 'M72 52 Q78 52 79.5 58 Q80 66 77 72 Q73 72 72 64 Z'],
  ['forearms', 'M76 74 Q81 74 82 80 Q84 92 83 100 Q79 102 77 98 Q74 86 74 78 Z'],
  ['quadriceps', 'M51 96 Q60 94 65 100 Q67 116 64 130 Q58 134 53 130 Q50 114 51 96 Z'],
  ['calves', 'M53 140 Q59 138 62 142 Q63 156 60 170 Q55 172 54 168 Q52 154 53 140 Z'],
];
const BACK: [string, string][] = [
  ['shoulders', 'M62 33 Q71 31 75 38 Q77 46 73 52 Q68 48 65 42 Z'],
  ['back', 'M51 30 Q60 31 66 38 Q68 52 63 66 Q58 74 51 76 Z'],
  ['triceps', 'M72 52 Q78 52 79.5 58 Q80 66 77 72 Q73 72 72 64 Z'],
  ['forearms', 'M76 74 Q81 74 82 80 Q84 92 83 100 Q79 102 77 98 Q74 86 74 78 Z'],
  ['glutes', 'M51 86 Q62 84 66 92 Q67 102 60 106 Q52 104 51 96 Z'],
  ['hamstrings', 'M51 108 Q60 106 65 110 Q66 124 63 136 Q57 138 53 134 Q50 120 51 108 Z'],
  ['calves', 'M53 142 Q60 140 63 146 Q64 158 60 170 Q55 171 54 166 Q52 154 53 142 Z'],
];

const names = (ids: string[]) => ids.map((i) => MUSCLE_GROUPS.find((m) => m.id === i)?.name ?? i);

type View = 'both' | 'front' | 'back' | 'auto';

/**
 * Front and back body figure. Pass `primary`/`secondary` muscle-group ids for one exercise, or `heat`
 * (muscle-group id -> training load) to shade each muscle by its share of the most-trained one.
 */
export function MuscleMap({ primary = '', secondary = [], heat, height = 190, view = 'both' }: {
  primary?: string; secondary?: string[]; heat?: Record<string, number>; height?: number; view?: View;
}) {
  const { colors } = useTheme();
  const main = new Set(EXPAND[primary] ?? []);
  const sec = new Set(secondary.flatMap((s) => EXPAND[s] ?? []));
  const regionHeat = new Map<string, number>();
  if (heat) {
    const top = Math.max(0, ...Object.values(heat));
    for (const [g, v] of Object.entries(heat)) for (const reg of EXPAND[g] ?? []) regionHeat.set(reg, Math.max(regionHeat.get(reg) ?? 0, top ? v / top : 0));
  }
  const level = (region: string): { fill: string; opacity: number } => {
    if (heat) { const v = regionHeat.get(region) ?? 0; return v > 0 ? { fill: colors.primary, opacity: 0.3 + 0.7 * v } : { fill: colors.border, opacity: 0.55 }; }
    if (main.has(region)) return { fill: colors.primary, opacity: 1 };
    if (sec.has(region)) return { fill: colors.primary, opacity: 0.4 };
    return { fill: colors.border, opacity: 0.55 };
  };

  const half = (shapes: [string, string][]) => shapes.map(([region, d], i) => { const l = level(region); return <Path key={i} d={d} fill={l.fill} opacity={l.opacity} stroke={colors.surface} strokeWidth={0.7} strokeLinejoin="round" />; });
  const figure = (shapes: [string, string][], dx: number) => (
    <G x={dx}>
      <Ellipse cx={50} cy={13} rx={8.5} ry={10.5} fill={colors.surfaceAlt} />
      <Path d="M45 22 L45 29 L55 29 L55 22 Z" fill={colors.surfaceAlt} />
      <Circle cx={88} cy={112} r={4} fill={colors.surfaceAlt} />
      <Circle cx={12} cy={112} r={4} fill={colors.surfaceAlt} />
      {SILHOUETTE.map((d, i) => <Path key={`r${i}`} d={d} fill={colors.surfaceAlt} />)}
      <G transform="translate(100 0) scale(-1 1)">{SILHOUETTE.map((d, i) => <Path key={`l${i}`} d={d} fill={colors.surfaceAlt} />)}</G>
      {half(shapes)}
      <G transform="translate(100 0) scale(-1 1)">{half(shapes)}</G>
    </G>
  );

  const involved = heat ? Object.keys(heat).filter((g) => (heat[g] ?? 0) > 0) : [primary, ...secondary].filter(Boolean);
  const regions = new Set(involved.flatMap((g) => EXPAND[g] ?? []));
  const auto: View = [...regions].some((r) => FRONT_REGIONS.has(r)) && [...regions].some((r) => !FRONT_REGIONS.has(r) && BACK_GROUPS.has(r)) ? 'both' : [...regions].some((r) => FRONT_REGIONS.has(r)) ? 'front' : regions.size ? 'back' : 'both';
  const v = view === 'auto' ? auto : view;
  const label = heat ? `Muscles trained: ${Object.entries(heat).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).map(([g]) => names([g])[0]).join(', ') || 'none'}` : `Muscles worked: primary ${names([primary]).join(', ')}${secondary.length ? `; secondary ${names(secondary).join(', ')}` : ''}`;
  const w = v === 'both' ? 210 : 100;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} 190`} accessibilityLabel={label} role="img">
      {v === 'both' ? <>{figure(FRONT, 0)}{figure(BACK, 110)}</> : v === 'front' ? figure(FRONT, 0) : figure(BACK, 0)}
    </Svg>
  );
}

/** Small colour key for a heat map: names of the muscles in play. */
export const muscleNames = names;
