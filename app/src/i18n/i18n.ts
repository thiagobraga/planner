import i18next, { type i18n as I18nInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { englishCatalog, portugueseBrazilCatalog, type TranslationCatalog, type TranslationKey } from './catalogs';
import type { Locale } from '../types/i18n';

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const satisfies readonly Locale[];
export const LOCALE_STORAGE_KEY = 'planner_locale';

export const defaultResources = {
  en: { translation: englishCatalog },
  'pt-BR': { translation: portugueseBrazilCatalog },
} as const satisfies Record<Locale, { translation: TranslationCatalog }>;

export function resolveLocale(locale: string | null | undefined): Locale {
  return locale?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function detectInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as Locale)) {
      return savedLocale as Locale;
    }
  }
  if (typeof navigator === 'undefined') return 'en';
  return resolveLocale(navigator.languages?.[0] ?? navigator.language);
}

export function createI18nInstance(
  initialLocale: string | null | undefined = 'en',
  resources: Resource = defaultResources,
): I18nInstance {
  const instance = i18next.createInstance();
  const lng = resolveLocale(initialLocale);
  void instance.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: 'translation',
    fallbackNS: 'translation',
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    returnEmptyString: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
  return instance;
}

export const i18n = createI18nInstance('en');

export function translate(
  locale: Locale,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const fixedT = i18n.getFixedT(resolveLocale(locale));
  return values ? fixedT(key, values) : fixedT(key);
}
