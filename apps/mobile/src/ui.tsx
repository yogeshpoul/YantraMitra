import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space, TOUCH } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.screen} edges={['left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={[s.content, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2} accessibilityRole="header">{children}</Text>;
export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, testID }: {
  title: string; onPress?: PressableProps['onPress']; variant?: Variant; loading?: boolean; disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const bg = { primary: colors.leaf, secondary: colors.white, ghost: 'transparent', danger: colors.red }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? colors.white : colors.leafDark;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: pressed || disabled ? 0.75 : 1 }, variant === 'secondary' && s.buttonBorder, style]}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...input} style={[s.input, error ? { borderColor: colors.red } : null, input.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]} />
      {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[s.chip, selected && { backgroundColor: colors.leaf, borderColor: colors.leaf }]}>
      <Text style={[s.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={[s.toggle, value && { borderColor: colors.leaf, backgroundColor: colors.leafLight }]}>
      <View style={[s.box, value && { backgroundColor: colors.leaf, borderColor: colors.leaf }]}>{value && <Text style={{ color: colors.white, fontWeight: '700' }}>✓</Text>}</View>
      <View style={{ flex: 1 }}><Text style={s.toggleLabel}>{label}</Text>{description ? <Text style={s.hint}>{description}</Text> : null}</View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const bg = { info: colors.leafLight, success: colors.leafLight, error: colors.redLight, warning: '#fdf0d5' }[tone];
  return <View accessibilityRole="alert" style={[s.banner, { backgroundColor: bg }]}><Text style={{ color: tone === 'error' ? colors.red : colors.ink, fontSize: 16 }}>{children}</Text></View>;
}

export const Loading = () => <View style={{ padding: space.xl }}><ActivityIndicator size="large" color={colors.leaf} /></View>;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.soil },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  h1: { fontSize: 26, fontWeight: '700', color: colors.ink },
  h2: { fontSize: 20, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 16, color: colors.muted },
  label: { fontSize: 16, fontWeight: '600', color: colors.ink },
  hint: { fontSize: 14, color: colors.muted },
  error: { fontSize: 14, color: colors.red, fontWeight: '600' },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: colors.soilBorder, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 17, color: colors.ink, backgroundColor: colors.white },
  button: { minHeight: TOUCH, borderRadius: radius.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonBorder: { borderWidth: 1, borderColor: colors.leafBorder },
  buttonText: { fontSize: 17, fontWeight: '700' },
  chip: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.leafBorder, backgroundColor: colors.white, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.leafDark },
  toggle: { flexDirection: 'row', gap: space.md, alignItems: 'center', minHeight: TOUCH, padding: space.md, borderWidth: 1, borderColor: colors.soilBorder, borderRadius: radius.md, backgroundColor: colors.white },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.soilBorder, padding: space.lg, gap: space.sm },
  banner: { borderRadius: radius.md, padding: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
