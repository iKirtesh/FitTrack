import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '../ui';

export interface Point { label: string; value: number }

/** Circular progress. `value` is 0..1; also exposed to screen readers as a percentage. */
export function ProgressRing({ value, size = 96, stroke = 10, label, sub, color }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; color?: string }) {
  const { colors } = useTheme();
  const v = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? colors.primary} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {label ? <Text variant="h2">{label}</Text> : null}
        {sub ? <Text variant="muted" style={{ fontSize: 11 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const niceMax = (m: number) => (m <= 0 ? 1 : 10 ** Math.floor(Math.log10(m)) * Math.ceil(m / 10 ** Math.floor(Math.log10(m))));

export function BarChart({ data, height = 140, width = 320, formatValue, highlightLast }: { data: Point[]; height?: number; width?: number; formatValue?: (n: number) => string; highlightLast?: boolean }) {
  const { colors } = useTheme();
  if (!data.length) return null;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const pad = 20, w = width, h = height;
  const bw = Math.max(4, Math.min(28, (w - pad) / data.length - 6));
  const step = (w - pad) / data.length;
  const every = Math.ceil(data.length / 7);
  return (
    <View accessible accessibilityLabel={`Bar chart. ${data.map((d) => `${d.label}: ${formatValue ? formatValue(d.value) : d.value}`).join(', ')}`}>
      <Svg width="100%" height={h + pad} viewBox={`0 0 ${w} ${h + pad}`}>
        <Line x1={pad} x2={w} y1={h} y2={h} stroke={colors.border} />
        <SvgText x={0} y={10} fill={colors.textMuted} fontSize={10}>{formatValue ? formatValue(max) : String(max)}</SvgText>
        {data.map((d, i) => {
          const bh = (d.value / max) * (h - 16);
          const x = pad + i * step + (step - bw) / 2;
          return (
            <G key={`${d.label}${i}`}>
              <Rect x={x} y={h - bh} width={bw} height={Math.max(bh, d.value > 0 ? 2 : 0)} rx={3} fill={highlightLast && i === data.length - 1 ? colors.accent : colors.primary} />
              {i % every === 0 ? <SvgText x={x + bw / 2} y={h + 14} fill={colors.textMuted} fontSize={10} textAnchor="middle">{d.label}</SvgText> : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export function LineChart({ data, height = 160, width = 320, formatValue, invert }: { data: Point[]; height?: number; width?: number; formatValue?: (n: number) => string; invert?: boolean }) {
  const { colors } = useTheme();
  if (data.length < 2) return null;
  const pad = 36, w = width, h = height;
  const vals = data.map((d) => d.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += 1; lo -= 1; }
  const m = (hi - lo) * 0.1; lo -= m; hi += m;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad - 8);
  const y = (v: number) => (invert ? ((v - lo) / (hi - lo)) : 1 - (v - lo) / (hi - lo)) * (h - 20) + 8;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  return (
    <View accessible accessibilityLabel={`Line chart from ${formatValue ? formatValue(vals[0]!) : vals[0]} to ${formatValue ? formatValue(vals[vals.length - 1]!) : vals[vals.length - 1]}, ${data.length} points`}>
      <Svg width="100%" height={h + 16} viewBox={`0 0 ${w} ${h + 16}`}>
        <Line x1={pad} x2={w - 8} y1={h - 12} y2={h - 12} stroke={colors.border} />
        <SvgText x={0} y={14} fill={colors.textMuted} fontSize={10}>{formatValue ? formatValue(hi) : hi.toFixed(1)}</SvgText>
        <SvgText x={0} y={h - 14} fill={colors.textMuted} fontSize={10}>{formatValue ? formatValue(lo) : lo.toFixed(1)}</SvgText>
        <Path d={path} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 40 ? data.map((d, i) => <Circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill={colors.primary} />) : null}
        <SvgText x={pad} y={h + 6} fill={colors.textMuted} fontSize={10}>{data[0]!.label}</SvgText>
        <SvgText x={w - 8} y={h + 6} fill={colors.textMuted} fontSize={10} textAnchor="end">{data[data.length - 1]!.label}</SvgText>
      </Svg>
    </View>
  );
}

/** Draws a recorded GPS route. No map tiles: the route is the real recorded polyline only. */
export function RouteView({ points, height = 220 }: { points: { latitude: number; longitude: number }[]; height?: number }) {
  const { colors } = useTheme();
  if (points.length < 2) return <Text variant="muted">No route recorded.</Text>;
  const lats = points.map((p) => p.latitude), lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const lonScale = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = Math.max((maxLon - minLon) * lonScale, 1e-6), spanY = Math.max(maxLat - minLat, 1e-6);
  const W = 320, H = height, pad = 16;
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const ox = (W - spanX * s) / 2, oy = (H - spanY * s) / 2;
  const px = (p: { latitude: number; longitude: number }) => `${(ox + (p.longitude - minLon) * lonScale * s).toFixed(1)},${(H - oy - (p.latitude - minLat) * s).toFixed(1)}`;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(p)}`).join(' ');
  const [sx, sy] = px(points[0]!).split(',').map(Number) as [number, number];
  const [ex, ey] = px(points[points.length - 1]!).split(',').map(Number) as [number, number];
  return (
    <View accessible accessibilityLabel="Route map of the recorded GPS track" style={{ backgroundColor: colors.surfaceAlt, borderRadius: 14, overflow: 'hidden' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={d} stroke={colors.primary} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={sx} cy={sy} r={6} fill={colors.success} />
        <Circle cx={ex} cy={ey} r={6} fill={colors.danger} />
      </Svg>
    </View>
  );
}
