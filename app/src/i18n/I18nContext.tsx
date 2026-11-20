import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { I18nContextValue, Locale, TranslationKey } from '../types/i18n';
import {
  createI18nInstance,
  detectInitialLocale,
  LOCALE_STORAGE_KEY,
  resolveLocale,
  SUPPORTED_LOCALES,
  translate,
} from './i18n';

export { resolveLocale, SUPPORTED_LOCALES, translate };
export type { Locale };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [instance] = useState(() => createI18nInstance(detectInitialLocale()));

  useEffect(() => {
    const syncDocumentLang = (lng: string) => {
      document.documentElement.lang = resolveLocale(lng);
    };
    syncDocumentLang(instance.resolvedLanguage ?? instance.language);
    instance.on('languageChanged', syncDocumentLang);
    return () => {
      instance.off('languageChanged', syncDocumentLang);
    };
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

export function useI18n(): I18nContextValue {
  const { t: i18nT, i18n: activeI18n } = useTranslation();
  const locale = resolveLocale(activeI18n.resolvedLanguage ?? activeI18n.language);

  const setLocale = useCallback(
    (nextLocale: string | null | undefined) => {
      const resolvedLocale = resolveLocale(nextLocale);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, resolvedLocale);
      }
      document.documentElement.lang = resolvedLocale;
      void activeI18n.changeLanguage(resolvedLocale);
    },
    [activeI18n],
  );

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      values ? i18nT(key, values) : i18nT(key),
    [i18nT],
  );

  const formatDate = useCallback(
    (date: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(date),
    [locale],
  );

  return {
    locale,
    setLocale,
    t,
    formatDate,
  };
}
