export { englishCatalog } from './locales/en';
export { portugueseBrazilCatalog } from './locales/pt-BR';
export type { TranslationCatalog, TranslationKey } from './types';

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
