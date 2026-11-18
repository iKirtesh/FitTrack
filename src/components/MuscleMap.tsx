import React from 'react';
import Svg, { Circle, Ellipse, G, Rect, Text as SvgText } from 'react-native-svg';
import { MUSCLE_GROUPS } from '@/constants/exercise';
import { useTheme } from '@/theme/ThemeProvider';

/** Drawing regions. An exercise's muscle-group ids are expanded onto these. */
const EXPAND: Record<string, string[]> = {
  chest: ['chest'], back: ['back'], shoulders: ['shoulders'], biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'], quadriceps: ['quadriceps'], hamstrings: ['hamstrings'], glutes: ['glutes'], calves: ['calves'],
  abs: ['abs'], core: ['abs', 'core'],
  full_body: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'core'],
};

type Shape = { region: string; kind: 'e' | 'r'; x: number; y: number; w: number; h: number };
const e = (region: string, cx: number, cy: number, rx: number, ry: number): Shape => ({ region, kind: 'e', x: cx, y: cy, w: rx, h: ry });
const r = (region: string, x: number, y: number, w: number, h: number): Shape => ({ region, kind: 'r', x, y, w, h });

// Each figure is 100 wide and drawn in an original, simplified style (not an anatomical atlas).
const FRONT: Shape[] = [
  e('shoulders', 29, 34, 8, 8), e('shoulders', 71, 34, 8, 8),
  e('chest', 40, 45, 10, 8), e('chest', 60, 45, 10, 8),
  e('biceps', 23, 53, 5, 11), e('biceps', 77, 53, 5, 11),
  e('forearms', 19, 77, 4.5, 12), e('forearms', 81, 77, 4.5, 12),
  r('abs', 43, 55, 14, 24), r('core', 34, 56, 8, 22), r('core', 58, 56, 8, 22),
  e('quadriceps', 41, 108, 9, 21), e('quadriceps', 59, 108, 9, 21),
  e('calves', 40, 152, 6, 16), e('calves', 60, 152, 6, 16),
];
const BACK: Shape[] = [
  e('shoulders', 29, 34, 8, 8), e('shoulders', 71, 34, 8, 8),
  r('back', 36, 30, 28, 32),
  e('triceps', 23, 53, 5, 11), e('triceps', 77, 53, 5, 11),
  e('forearms', 19, 77, 4.5, 12), e('forearms', 81, 77, 4.5, 12),
  e('glutes', 42, 88, 9, 8), e('glutes', 58, 88, 9, 8),
  e('hamstrings', 41, 116, 9, 17), e('hamstrings', 59, 116, 9, 17),
  e('calves', 40, 152, 6, 16), e('calves', 60, 152, 6, 16),
];

const names = (ids: string[]) => ids.map((i) => MUSCLE_GROUPS.find((m) => m.id === i)?.name ?? i);

/** Front and back figure with the primary muscle highlighted and secondary muscles tinted. */
export function MuscleMap({ primary = '', secondary = [], heat, height = 190 }: { primary?: string; secondary?: string[]; /** Optional training load per muscle-group id (any positive scale); shades each region by its share of the maximum. */ heat?: Record<string, number>; height?: number }) {
  const { colors } = useTheme();
  const main = new Set(EXPAND[primary] ?? []);
  const sec = new Set(secondary.flatMap((s) => EXPAND[s] ?? []));
  const regionHeat = new Map<string, number>();
  if (heat) {
    const top = Math.max(0, ...Object.values(heat));
    for (const [g, v] of Object.entries(heat)) for (const reg of EXPAND[g] ?? []) regionHeat.set(reg, Math.max(regionHeat.get(reg) ?? 0, top ? v / top : 0));
  }
  const fill = (region: string) => (heat ? ((regionHeat.get(region) ?? 0) > 0 ? colors.primary : colors.surfaceAlt) : main.has(region) ? colors.primary : sec.has(region) ? colors.warning : colors.surfaceAlt);
  const opacity = (region: string) => (heat ? 0.25 + 0.75 * (regionHeat.get(region) ?? 0) : main.has(region) ? 1 : sec.has(region) ? 0.8 : 1);
  const body = colors.border;

  const draw = (shapes: Shape[], dx: number) => (
    <G x={dx}>
      <Circle cx={50} cy={14} r={9} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={46} y={22} width={8} height={7} rx={2} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={33} y={30} width={34} height={50} rx={10} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={36} y={78} width={28} height={12} rx={6} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={32} y={88} width={15} height={52} rx={7} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={53} y={88} width={15} height={52} rx={7} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={34} y={138} width={12} height={36} rx={6} fill={colors.surfaceAlt} stroke={body} />
      <Rect x={54} y={138} width={12} height={36} rx={6} fill={colors.surfaceAlt} stroke={body} />
      {shapes.map((s, i) => s.kind === 'e'
        ? <Ellipse key={i} cx={s.x} cy={s.y} rx={s.w} ry={s.h} fill={fill(s.region)} opacity={opacity(s.region)} />
        : <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={5} fill={fill(s.region)} opacity={opacity(s.region)} />)}
    </G>
  );

  const label = heat ? `Muscles trained: ${Object.entries(heat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([g]) => names([g])[0]).join(', ') || 'none'}` : `Muscles worked: primary ${names([primary]).join(', ')}${secondary.length ? `; secondary ${names(secondary).join(', ')}` : ''}`;
  return (
    <Svg width="100%" height={height} viewBox="0 0 220 190" accessibilityLabel={label} role="img">
      {draw(FRONT, 5)}
      {draw(BACK, 115)}
      <SvgText x={55} y={188} fontSize={9} fontFamily="sans-serif" fill={colors.textMuted} textAnchor="middle">Front</SvgText>
      <SvgText x={165} y={188} fontSize={9} fontFamily="sans-serif" fill={colors.textMuted} textAnchor="middle">Back</SvgText>
    </Svg>
  );
}
