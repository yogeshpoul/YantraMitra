'use client';
import { ApiError } from '@yantramitra/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Maps an API error to localised text and per-field messages. */
export function useErrorText() {
  const t = useTranslations();
  return useCallback(
    (e: unknown): { message: string; fields: Record<string, string> } => {
      if (!(e instanceof ApiError)) return { message: t('errors.INTERNAL_ERROR'), fields: {} };
      const fields: Record<string, string> = {};
      for (const [field, key] of Object.entries(e.details)) fields[field] = t.has(`validation.${key}`) ? t(`validation.${key}`) : t('validation.invalid');
      return { message: t.has(`errors.${e.code}`) ? t(`errors.${e.code}`) : t('errors.INTERNAL_ERROR'), fields };
    },
    [t],
  );
}

/** Localises client-side Zod field errors (message keys). */
export function useFieldText() {
  const t = useTranslations('validation');
  return useCallback((errors: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(errors)) out[k] = t.has(v) ? t(v) : t('invalid');
    return out;
  }, [t]);
}
