import 'i18next';
import type { englishCatalog } from '../i18n/catalogs';

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
      translation: Record<keyof typeof englishCatalog, string>;
    };
  }
}
