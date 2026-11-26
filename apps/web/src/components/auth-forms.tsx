'use client';
import { LOCALES, safeNextPath, type Locale } from '@yantramitra/shared-types';
import { changePasswordSchema, fieldErrors, loginSchema, registerSchema } from '@yantramitra/shared-validation';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText, useFieldText } from '@/lib/errors';
import { useAuth } from './auth-context';
import { Alert, Button, Field, Input, Select } from './ui';

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations('auth');
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t('hidePassword') : t('showPassword')} className="absolute right-2 top-2 rounded-lg p-1.5 text-muted hover:bg-soil-100">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bind = (name: keyof T & string) => ({
    name, value: values[name], onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });
  return { values, errors, setErrors, message, setMessage, busy, setBusy, bind };
}

/** Where to go after authentication: the page that asked for login, never an external URL. */
function useNext() {
  const params = useSearchParams();
  // The router adds the current language itself, so a language prefix in `next` is removed.
  return safeNextPath(params.get('next'), '/').replace(/^\/(mr|hi|en)(?=\/|$|\?)/, '') || '/';
}

export function LoginForm() {
  const t = useTranslations('auth');
  const tv = useFieldText();
  const errorText = useErrorText();
  const router = useRouter();
  const next = useNext();
  const { login } = useAuth();
  const f = useForm({ mobile: '', password: '' });
  const params = useSearchParams();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(f.values);
    if (!parsed.success) return f.setErrors(tv(fieldErrors(parsed.error)));
    f.setErrors({}); f.setMessage(null); f.setBusy(true);
    try {
      const me = await login(f.values);
      router.replace(me.mustChangePassword ? `/change-password?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      const r = errorText(err);
      f.setMessage(r.message); f.setErrors(r.fields); f.setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="login-form">
      {params.get('next') && <Alert tone="info">{t('loginRequired')}</Alert>}
      {f.message && <Alert tone="error">{f.message}</Alert>}
      <Field label={t('mobile')} hint={t('mobileHint')} error={f.errors.mobile}>
        {(p) => <Input {...p} {...f.bind('mobile')} type="tel" inputMode="tel" autoComplete="tel" />}
      </Field>
      <Field label={t('password')} error={f.errors.password}>
        {(p) => <PasswordInput {...p} {...f.bind('password')} autoComplete="current-password" />}
      </Field>
      <Button type="submit" className="w-full text-lg" loading={f.busy}>{t('loginButton')}</Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="font-medium text-leaf-700 hover:underline">{t('forgot')}</Link>
        <span>{t('noAccount')} <Link href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-leaf-700 hover:underline">{t('registerButton')}</Link></span>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations();
  const tv = useFieldText();
  const errorText = useErrorText();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const next = useNext();
  const { register } = useAuth();
  const f = useForm({ fullName: '', mobile: '', password: '', confirmPassword: '', preferredLocale: locale as string });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(f.values);
    if (!parsed.success) return f.setErrors(tv(fieldErrors(parsed.error)));
    f.setErrors({}); f.setMessage(null); f.setBusy(true);
    try {
      await register(f.values as Parameters<typeof register>[0]);
      router.replace(next, { locale: f.values.preferredLocale as Locale });
    } catch (err) {
      const r = errorText(err);
      f.setMessage(r.message); f.setErrors(r.fields); f.setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="register-form">
      {f.message && <Alert tone="error">{f.message}</Alert>}
      <Field label={t('auth.fullName')} error={f.errors.fullName}>{(p) => <Input {...p} {...f.bind('fullName')} autoComplete="name" />}</Field>
      <Field label={t('auth.mobile')} hint={t('auth.mobileHint')} error={f.errors.mobile}>
        {(p) => <Input {...p} {...f.bind('mobile')} type="tel" inputMode="tel" autoComplete="tel" />}
      </Field>
      <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={f.errors.password}>
        {(p) => <PasswordInput {...p} {...f.bind('password')} autoComplete="new-password" />}
      </Field>
      <Field label={t('auth.confirmPassword')} error={f.errors.confirmPassword}>
        {(p) => <PasswordInput {...p} {...f.bind('confirmPassword')} autoComplete="new-password" />}
      </Field>
      <Field label={t('auth.preferredLanguage')} error={f.errors.preferredLocale}>
        {(p) => <Select {...p} {...f.bind('preferredLocale')}>{LOCALES.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}</Select>}
      </Field>
      <p className="text-sm text-muted">{t('auth.noOtpNote')}</p>
      <Button type="submit" className="w-full text-lg" loading={f.busy}>{t('auth.registerButton')}</Button>
      <p className="text-center text-sm">{t('auth.haveAccount')} <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-leaf-700 hover:underline">{t('auth.loginButton')}</Link></p>
    </form>
  );
}

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations('auth');
  const tv = useFieldText();
  const errorText = useErrorText();
  const { user, setUser } = useAuth();
  const router = useRouter();
  const next = useNext();
  const forced = user?.mustChangePassword ?? false;
  const f = useForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse(f.values);
    if (!parsed.success) return f.setErrors(tv(fieldErrors(parsed.error)));
    f.setErrors({}); f.setMessage(null); f.setBusy(true);
    try {
      setUser(await api.auth.changePassword(f.values));
      setDone(true);
      f.setBusy(false);
      if (forced) router.replace(next);
      onDone?.();
    } catch (err) {
      const r = errorText(err);
      f.setMessage(r.message); f.setErrors(r.fields); f.setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="change-password-form">
      {forced && <Alert tone="warning">{t('mustChange')}</Alert>}
      {done && <Alert tone="success">{t('passwordChanged')}</Alert>}
      {f.message && <Alert tone="error">{f.message}</Alert>}
      <Field label={t('currentPassword')} error={f.errors.currentPassword}>{(p) => <PasswordInput {...p} {...f.bind('currentPassword')} autoComplete="current-password" />}</Field>
      <Field label={t('newPassword')} hint={t('passwordHint')} error={f.errors.newPassword}>{(p) => <PasswordInput {...p} {...f.bind('newPassword')} autoComplete="new-password" />}</Field>
      <Field label={t('confirmPassword')} error={f.errors.confirmPassword}>{(p) => <PasswordInput {...p} {...f.bind('confirmPassword')} autoComplete="new-password" />}</Field>
      <Button type="submit" loading={f.busy}>{t('changeButton')}</Button>
    </form>
  );
}
