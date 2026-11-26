import { LOCALES, type Locale } from '@yantramitra/shared-types';
import { registerSchema } from '@yantramitra/shared-validation';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useAuth } from '@/auth';
import { useErrors } from '@/errors';
import { useLocaleState } from '@/i18n';
import { Banner, Button, Chip, Field, Muted, s, Screen } from '@/ui';
import { returnAfterAuth } from '@/nav';

export default function Register() {
  const t = useTranslations();
  const errors = useErrors();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { register } = useAuth();
  const { locale, setLocale } = useLocaleState();
  const [v, setV] = useState({ fullName: '', mobile: '', password: '', confirmPassword: '', preferredLocale: locale as Locale });
  const [err, setErr] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));

  const submit = async () => {
    const parsed = registerSchema.safeParse(v);
    if (!parsed.success) return setErr(errors.zod(parsed.error));
    setErr({}); setMessage(null); setBusy(true);
    try {
      await register(v);
      setLocale(v.preferredLocale);
      returnAfterAuth(next);
    } catch (e) {
      const r = errors.api(e);
      setMessage(r.message); setErr(r.fields); setBusy(false);
    }
  };

  return (
    <Screen>
      {message && <Banner tone="error">{message}</Banner>}
      <Field label={t('auth.fullName')} value={v.fullName} onChangeText={set('fullName')} autoComplete="name" error={err.fullName} />
      <Field label={t('auth.mobile')} hint={t('auth.mobileHint')} value={v.mobile} onChangeText={set('mobile')} keyboardType="phone-pad" error={err.mobile} />
      <Field label={t('auth.password')} hint={t('auth.passwordHint')} value={v.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" error={err.password} />
      <Field label={t('auth.confirmPassword')} value={v.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry error={err.confirmPassword} />
      <View style={{ gap: 6 }}>
        <Text style={s.label}>{t('auth.preferredLanguage')}</Text>
        <View style={s.row}>{LOCALES.map((l) => <Chip key={l} label={t(`lang.${l}`)} selected={v.preferredLocale === l} onPress={() => setV((o) => ({ ...o, preferredLocale: l }))} />)}</View>
      </View>
      <Muted>{t('auth.noOtpNote')}</Muted>
      <Button title={t('auth.registerButton')} loading={busy} onPress={submit} />
      <Button variant="ghost" title={`${t('auth.haveAccount')} ${t('auth.loginButton')}`} onPress={() => router.replace({ pathname: '/login', params: next ? { next } : {} })} />
    </Screen>
  );
}
