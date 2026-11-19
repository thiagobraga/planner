import { englishCatalog as englishBase } from './locales/en';
import { portugueseBrazilCatalog as portugueseBase } from './locales/pt-BR';
import { collectionsEnglish, collectionsPortuguese } from './locales/collections';
import { errorsEnglish, errorsPortuguese } from './locales/errors';

export const englishCatalog = { ...englishBase, ...collectionsEnglish, ...errorsEnglish };
export const portugueseBrazilCatalog = { ...portugueseBase, ...collectionsPortuguese, ...errorsPortuguese };

export type { TranslationCatalog, TranslationKey } from './types';
