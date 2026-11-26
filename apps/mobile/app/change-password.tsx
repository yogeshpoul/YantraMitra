import { changePasswordSchema } from '@yantramitra/shared-validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useErrors } from '@/errors';
import { SignedIn } from '@/SignedIn';
import { Banner, Button, Field, Screen } from '@/ui';

function ChangePassword() {
  const t = useTranslations('auth');
  const errors = useErrors();
  const { user, setUser } = useAuth();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const forced = user?.mustChangePassword ?? false;

  const submit = async () => {
    const parsed = changePasswordSchema.safeParse(v);
    if (!parsed.success) return setErr(errors.zod(parsed.error));
    setErr({}); setBusy(true);
    try {
      setUser(await api.auth.changePassword(v));
      setMessage({ tone: 'success', text: t('passwordChanged') });
      setV({ currentPassword: '', newPassword: '', confirmPassword: '' });
      if (forced) router.replace('/');
    } catch (e) {
      const r = errors.api(e);
      setMessage({ tone: 'error', text: r.message }); setErr(r.fields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {forced && <Banner tone="warning">{t('mustChange')}</Banner>}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <Field label={t('currentPassword')} value={v.currentPassword} onChangeText={(x) => setV((o) => ({ ...o, currentPassword: x }))} secureTextEntry error={err.currentPassword} />
      <Field label={t('newPassword')} hint={t('passwordHint')} value={v.newPassword} onChangeText={(x) => setV((o) => ({ ...o, newPassword: x }))} secureTextEntry error={err.newPassword} />
      <Field label={t('confirmPassword')} value={v.confirmPassword} onChangeText={(x) => setV((o) => ({ ...o, confirmPassword: x }))} secureTextEntry error={err.confirmPassword} />
      <Button title={t('changeButton')} loading={busy} onPress={submit} />
    </Screen>
  );
}

export default function ChangePasswordScreen() {
  return <SignedIn><ChangePassword /></SignedIn>;
}
