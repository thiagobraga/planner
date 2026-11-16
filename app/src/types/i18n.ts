import type { ParseKeys } from 'i18next';
import type { englishCatalog } from '../i18n/locales/en';

export type Locale = 'en' | 'pt-BR';
export type TranslationKey = ParseKeys<'translation'>;
export type TranslationCatalog = Record<keyof typeof englishCatalog, string>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: string | null | undefined) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}
