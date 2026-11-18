import React from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, font, radius, space } from '@/theme/tokens';

export function Screen({ children, scroll = true, padded = true, style }: { children: React.ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const body = <View style={[{ padding: padded ? space.lg : 0, gap: space.lg }, Platform.OS === 'web' && { maxWidth: 880, width: '100%', alignSelf: 'center' }, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

type Variant = 'h1' | 'h2' | 'body' | 'muted' | 'label' | 'big';
export function Text({ variant = 'body', style, ...p }: React.ComponentProps<typeof RNText> & { variant?: Variant }) {
  const { colors } = useTheme();
  const v: Record<Variant, TextStyle> = {
    h1: { fontSize: font.xl, fontWeight: '800', color: colors.text },
    h2: { fontSize: font.lg, fontWeight: '700', color: colors.text },
    body: { fontSize: font.md, color: colors.text },
    muted: { fontSize: font.sm, color: colors.textMuted },
    label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
    big: { fontSize: font.xxl, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  };
  return <RNText {...p} style={[v[variant], style]} />;
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const s = [{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: space.sm }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, danger: colors.danger, ghost: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, danger: '#FFFFFF', ghost: colors.primaryText }[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [{ minHeight: MIN_TOUCH + 4, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <RNText style={{ color: fg, fontSize: font.md, fontWeight: '700' }}>{icon ? `${icon}  ` : ''}{title}</RNText>}
    </Pressable>
  );
}

export function Field({ label, error, hint, ...p }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs, flex: 1 }}>
      <Text variant="label">{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.textMuted} {...p}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, fontSize: font.md }, p.multiline && { minHeight: 88, paddingTop: space.md, textAlignVertical: 'top' }, p.style]} />
      {error ? <Text variant="muted" style={{ color: colors.danger }} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? colors.primary : colors.surfaceAlt }}>
      <RNText style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: font.sm }}>{label}</RNText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>{children}</View>;
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label">{label}</Text>
      <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      {sub ? <Text variant="muted">{sub}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Text variant="h2" style={{ textAlign: 'center' }}>{title}</Text>
      <Text variant="muted" style={{ textAlign: 'center' }}>{body}</Text>
      {action}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <Row style={{ justifyContent: 'space-between' }}><Text variant="h2">{title}</Text>{action}</Row>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)}
          style={{ flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 3, backgroundColor: o.value === value ? colors.surface : 'transparent' }}>
          <RNText style={{ color: o.value === value ? colors.text : colors.textMuted, fontWeight: '700', fontSize: font.sm }}>{o.label}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Pill({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const { colors } = useTheme();
  const c = { muted: colors.textMuted, success: colors.success, warning: colors.warning, danger: colors.danger, primary: colors.primaryText }[tone];
  return <View style={{ borderColor: c, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><RNText style={{ color: c, fontSize: font.xs, fontWeight: '700' }}>{text}</RNText></View>;
}

/** Text field that reports its value on blur/submit (not per keystroke). Works on native and web. */
export function CommitField({ label, initial, onCommit, ...p }: Omit<TextInputProps, 'value' | 'onChangeText' | 'defaultValue'> & { label: string; initial: string; onCommit: (text: string) => void }) {
  const [text, setText] = React.useState(initial);
  React.useEffect(() => setText(initial), [initial]);
  const commit = () => { if (text !== initial) onCommit(text); };
  return <Field {...p} label={label} value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit} />;
}
