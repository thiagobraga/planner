import { englishCatalog as englishBase } from './locales/en';
import { portugueseBrazilCatalog as portugueseBase } from './locales/pt-BR';
import { collectionsEnglish, collectionsPortuguese } from './locales/collections';
import { errorsEnglish, errorsPortuguese } from './locales/errors';
import { detailsEnglish, detailsPortuguese } from './locales/details';

export const englishCatalog = { ...englishBase, ...collectionsEnglish, ...errorsEnglish, ...detailsEnglish };
export const portugueseBrazilCatalog = { ...portugueseBase, ...collectionsPortuguese, ...errorsPortuguese, ...detailsPortuguese };

export type { TranslationCatalog, TranslationKey } from './types';
