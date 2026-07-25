import { englishCatalog } from './locales/en';

export type TranslationKey = keyof typeof englishCatalog;
export type TranslationCatalog = Record<TranslationKey, string>;
