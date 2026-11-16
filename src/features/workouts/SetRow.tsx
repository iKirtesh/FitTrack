import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pill, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import type { TrackingType } from '@/constants/exercise';
import type { WorkoutSet } from '@/database/repositories/workouts';
import { displayToKg, kgToDisplay, round, formatWeight } from '@/utils/units';
import type { WeightUnit } from '@/constants/profile';

export interface SetPatchUI { weightKg?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null }

function NumInput({ value, onCommit, label, width = 64, decimal }: { value: string; onCommit: (v: number | null) => void; label: string; width?: number; decimal?: boolean }) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput accessibilityLabel={label} value={text} onChangeText={setText} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus
      onEndEditing={() => { const n = parseFloat(text.replace(',', '.')); onCommit(text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n); }}
      placeholder="-" placeholderTextColor={colors.textMuted}
      style={{ width, minHeight: MIN_TOUCH, textAlign: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 16, fontWeight: '700' }} />
  );
}

export function SetRow({ set, index, tracking, unit, previous, isPr, onChange, onToggle, onDelete }: {
  set: WorkoutSet; index: number; tracking: TrackingType; unit: WeightUnit; previous?: WorkoutSet; isPr: boolean;
  onChange: (p: SetPatchUI) => void; onToggle: () => void; onDelete: () => void;
}) {
  const { colors } = useTheme();
  const w = set.weightKg == null ? '' : String(round(kgToDisplay(set.weightKg, unit), 1));
  const prev = !previous ? '-' : tracking === 'weight_reps' || tracking === 'assisted' ? `${formatWeight(previous.weightKg, unit, 1).replace(` ${unit}`, '')}×${previous.reps ?? '-'}`
    : tracking === 'bodyweight_reps' ? `${previous.reps ?? '-'}` : tracking === 'distance' ? `${previous.distanceM ?? '-'} m` : `${previous.durationSec ?? '-'}s`;
  const showWeight = tracking === 'weight_reps' || tracking === 'assisted';
  const showReps = tracking === 'weight_reps' || tracking === 'assisted' || tracking === 'bodyweight_reps';
  const showDur = tracking === 'timed' || tracking === 'duration' || tracking === 'distance';
  const showDist = tracking === 'distance';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: set.isCompleted ? 0.95 : 1, backgroundColor: set.isCompleted ? colors.surfaceAlt : 'transparent', borderRadius: radius.md, paddingVertical: 2, paddingHorizontal: 4 }}>
      <View style={{ width: 28, alignItems: 'center' }}><Text variant="muted" style={{ fontWeight: '700' }}>{set.kind === 'warmup' ? 'W' : index + 1}</Text></View>
      <View style={{ width: 62 }}><Text variant="muted" numberOfLines={1}>{prev}</Text></View>
      {showWeight ? <NumInput decimal width={72} label={`Set ${index + 1} ${tracking === 'assisted' ? 'assistance' : 'weight'} (${unit})`} value={w} onCommit={(v) => onChange({ weightKg: v == null ? null : displayToKg(v, unit) })} /> : null}
      {showReps ? <NumInput width={60} label={`Set ${index + 1} reps`} value={set.reps == null ? '' : String(set.reps)} onCommit={(v) => onChange({ reps: v == null ? null : Math.round(v) })} /> : null}
      {showDist ? <NumInput decimal width={72} label={`Set ${index + 1} distance (m)`} value={set.distanceM == null ? '' : String(set.distanceM)} onCommit={(v) => onChange({ distanceM: v })} /> : null}
      {showDur ? <NumInput width={64} label={`Set ${index + 1} duration (seconds)`} value={set.durationSec == null ? '' : String(set.durationSec)} onCommit={(v) => onChange({ durationSec: v == null ? null : Math.round(v) })} /> : null}
      {isPr ? <Pill text="PR" tone="success" /> : null}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.isCompleted }} accessibilityLabel={`Mark set ${index + 1} complete`} onPress={onToggle}
        style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: set.isCompleted ? colors.primary : colors.surfaceAlt }}>
        <Ionicons name="checkmark" size={22} color={set.isCompleted ? colors.onPrimary : colors.textMuted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete set ${index + 1}`} onPress={onDelete} style={{ width: 36, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
