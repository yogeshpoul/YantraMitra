import { ApiError } from '@yantramitra/api-client';
import { fieldErrors, type z } from '@yantramitra/shared-validation';
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'use-intl';

export function useErrors() {
  const t = useTranslations();
  const api = useCallback((e: unknown) => {
    if (!(e instanceof ApiError)) return { message: t('errors.INTERNAL_ERROR'), fields: {} as Record<string, string> };
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(e.details)) fields[k] = t.has(`validation.${v}`) ? t(`validation.${v}`) : t('validation.invalid');
    return { message: t.has(`errors.${e.code}`) ? t(`errors.${e.code}`) : t('errors.INTERNAL_ERROR'), fields };
  }, [t]);
  const zod = useCallback((error: z.ZodError) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErrors(error))) out[k] = t.has(`validation.${v}`) ? t(`validation.${v}`) : t('validation.invalid');
    return out;
  }, [t]);
  // Stable identity: screens list this in effect dependencies.
  return useMemo(() => ({ api, zod }), [api, zod]);
}
