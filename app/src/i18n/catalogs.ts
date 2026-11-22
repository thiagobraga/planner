import { englishCatalog as englishBase } from './locales/en';
import { portugueseBrazilCatalog as portugueseBase } from './locales/pt-BR';
import { collectionsEnglish, collectionsPortuguese } from './locales/collections';
import { errorsEnglish, errorsPortuguese } from './locales/errors';
import { detailsEnglish, detailsPortuguese } from './locales/details';
import { viewEnglish, viewPortuguese } from './locales/view';

export const englishCatalog = { ...englishBase, ...collectionsEnglish, ...errorsEnglish, ...detailsEnglish, ...viewEnglish };
export const portugueseBrazilCatalog = { ...portugueseBase, ...collectionsPortuguese, ...errorsPortuguese, ...detailsPortuguese, ...viewPortuguese };

export type { TranslationCatalog, TranslationKey } from './types';
