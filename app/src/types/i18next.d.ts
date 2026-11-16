import 'i18next';
import type { TranslationCatalog } from './i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    returnNull: false;
    returnObjects: false;
    keySeparator: false;
    nsSeparator: false;
    strictKeyChecks: true;
    strictInterpolationChecks: false;
    resources: {
      translation: TranslationCatalog;
    };
  }
}
