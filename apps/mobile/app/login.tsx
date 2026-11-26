import { loginSchema } from '@yantramitra/shared-validation';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { useAuth } from '@/auth';
import { useErrors } from '@/errors';
import { returnAfterAuth } from '@/nav';
import { Banner, Button, Field, Muted, Screen } from '@/ui';


export default function Login() {
  const t = useTranslations();
  const errors = useErrors();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = loginSchema.safeParse({ mobile, password });
    if (!parsed.success) return setErr(errors.zod(parsed.error));
    setErr({}); setMessage(null); setBusy(true);
    try {
      const me = await login({ mobile, password });
      if (me.mustChangePassword) router.replace('/change-password');
      else returnAfterAuth(next);
    } catch (e) {
      const r = errors.api(e);
      setMessage(r.message); setErr(r.fields); setBusy(false);
    }
  };

  return (
    <Screen>
      {next && <Banner>{t('auth.loginRequired')}</Banner>}
      {message && <Banner tone="error">{message}</Banner>}
      <Field label={t('auth.mobile')} hint={t('auth.mobileHint')} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" autoComplete="tel" error={err.mobile} />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" error={err.password} />
      <Button title={t('auth.loginButton')} loading={busy} onPress={submit} />
      <Muted>{t('auth.forgotText')}</Muted>
      <Button variant="ghost" title={`${t('auth.noAccount')} ${t('auth.registerButton')}`} onPress={() => router.replace({ pathname: '/register', params: next ? { next } : {} })} />
    </Screen>
  );
}
