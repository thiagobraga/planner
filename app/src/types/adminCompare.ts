import type { TranslationKey } from '../i18n/catalogs';

export type CompareStatus = 'yes' | 'no' | 'partial' | 'unknown';
export type CompareProduct = 'planner' | 'todoist' | 'habitica' | 'microsoftTodo' | 'googleTasks' | 'rememberTheMilk' | 'jira';

type CompareFeatureKey = Extract<TranslationKey, `compare.features.${string}`> extends `compare.features.${infer Key}` ? Key : never;
type CompareCategory = Extract<TranslationKey, `compare.categories.${string}`> extends `compare.categories.${infer Category}` ? Category : never;

export interface CompareFeature extends Record<CompareProduct, CompareStatus> {
  key: CompareFeatureKey;
  category: CompareCategory | '';
}

export interface CompareColumn {
  id: CompareProduct;
  header: string;
  key: CompareProduct;
}
