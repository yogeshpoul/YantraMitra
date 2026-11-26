'use client';
import { LOCALES, type Locale } from '@yantramitra/shared-types';
import { updateProfileSchema, fieldErrors } from '@yantramitra/shared-validation';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { ChangePasswordForm } from '@/components/auth-forms';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText, useFieldText } from '@/lib/errors';

function Profile() {
  const t = useTranslations();
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const errorText = useErrorText();
  const tv = useFieldText();
  const [fullName, setFullName] = useState(user!.fullName);
  const [preferredLocale, setLocale] = useState<Locale>(user!.preferredLocale);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; error?: string; fields?: Record<string, string> }>({});

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = updateProfileSchema.safeParse({ fullName, preferredLocale });
    if (!parsed.success) return setState({ fields: tv(fieldErrors(parsed.error)) });
    setState({ busy: true });
    try {
      const me = await api.users.update({ fullName, preferredLocale });
      setUser(me);
      setState({ ok: true });
      router.replace(pathname, { locale: me.preferredLocale });
    } catch (err) {
      const r = errorText(err);
      setState({ error: r.message, fields: r.fields });
    }
  };

  return (
    <div className="container-page max-w-2xl space-y-6 py-8">
      <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
      <Card>
        <form onSubmit={save} className="space-y-4" noValidate>
          {state.ok && <Alert tone="success">{t('profile.saved')}</Alert>}
          {state.error && <Alert tone="error">{state.error}</Alert>}
          <Field label={t('profile.name')} error={state.fields?.fullName}>{(p) => <Input {...p} value={fullName} onChange={(e) => setFullName(e.target.value)} />}</Field>
          <Field label={t('profile.mobile')}>{(p) => <Input {...p} value={user!.mobile} readOnly disabled />}</Field>
          <Field label={t('profile.language')}>{(p) => (
            <Select {...p} value={preferredLocale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
            </Select>)}
          </Field>
          <Button type="submit" loading={state.busy}>{t('common.save')}</Button>
        </form>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">{t('profile.security')}</h2>
        <Suspense><ChangePasswordForm /></Suspense>
      </Card>
      <Button variant="secondary" onClick={async () => { await logout(); router.replace('/'); }} data-testid="logout">
        <LogOut className="size-5" aria-hidden />{t('nav.logout')}
      </Button>
    </div>
  );
}

export default function ProfilePage() {
  return <RequireAuth><Profile /></RequireAuth>;
}
