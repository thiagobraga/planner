import type { Locale, TranslationKey } from '../i18n/catalogs';

export interface HelpSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface HelpContent {
  title: string;
  subtitle: string;
  onThisPage: string;
  then: string;
  sections: HelpSection[];
  shortcutsTitle: string;
  shortcuts: Array<{ keys: string[]; label: string }>;
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: string | null | undefined) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}
