import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '@yantramitra/i18n/locales/en.json';
import hi from '@yantramitra/i18n/locales/hi.json';
import mr from '@yantramitra/i18n/locales/mr.json';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@yantramitra/shared-types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';

const MESSAGES = { mr, hi, en } as const;
const KEY = 'ym.locale';

interface LocaleState {
  locale: Locale;
  /** False until the user has chosen a language once on this device */
  chosen: boolean;
  ready: boolean;
  setLocale: (l: Locale) => void;
}
const LocaleContext = createContext<LocaleState | null>(null);

/** Same translation files as the website; the language can be changed at any time. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && (LOCALES as readonly string[]).includes(v)) { setLocaleState(v as Locale); setChosen(true); }
    }).finally(() => setReady(true));
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setChosen(true);
    void AsyncStorage.setItem(KEY, l);
  }, []);

  const value = useMemo(() => ({ locale, chosen, ready, setLocale }), [locale, chosen, ready, setLocale]);
  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Kolkata" onError={() => undefined}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleState(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocaleState outside I18nProvider');
  return ctx;
}
