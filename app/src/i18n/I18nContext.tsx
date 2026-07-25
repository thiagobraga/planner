import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  englishCatalog,
  portugueseBrazilCatalog,
  type TranslationCatalog,
  type TranslationKey,
} from './catalogs';

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const catalogs: Record<Locale, TranslationCatalog> = {
  en: englishCatalog,
  'pt-BR': portugueseBrazilCatalog,
};
const LOCALE_STORAGE_KEY = 'planner_locale';

export function resolveLocale(locale: string | null | undefined): Locale {
  return locale?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string {
  const template = catalogs[locale][key] ?? englishCatalog[key];
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: string | null | undefined) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

const defaultValue: I18nContextValue = {
  locale: 'en',
  setLocale: () => {},
  t: (key, values) => translate('en', key, values),
  formatDate: (date, options) => new Intl.DateTimeFormat('en', options).format(date),
};

const I18nContext = createContext<I18nContextValue>(defaultValue);

function browserLocale(): Locale {
  if (typeof window !== 'undefined') {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as Locale)) {
      return savedLocale as Locale;
    }
  }
  if (typeof navigator === 'undefined') return 'en';
  return resolveLocale(navigator.languages?.[0] ?? navigator.language);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setResolvedLocale] = useState<Locale>(browserLocale);
  const setLocale = useCallback((nextLocale: string | null | undefined) => {
    const resolvedLocale = resolveLocale(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, resolvedLocale);
    }
    setResolvedLocale(resolvedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    setLocale,
    t: (key, values) => translate(locale, key, values),
    formatDate: (date, options) => new Intl.DateTimeFormat(locale, options).format(date),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
