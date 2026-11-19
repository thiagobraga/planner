import { englishCatalog as englishBase } from './locales/en';
import { portugueseBrazilCatalog as portugueseBase } from './locales/pt-BR';
import { collectionsEnglish, collectionsPortuguese } from './locales/collections';

export const englishCatalog = { ...englishBase, ...collectionsEnglish };
export const portugueseBrazilCatalog = { ...portugueseBase, ...collectionsPortuguese };

export type { TranslationCatalog, TranslationKey } from './types';
