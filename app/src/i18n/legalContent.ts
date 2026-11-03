import type { Locale } from './I18nContext';
import type { PrivacyPolicyContent, TermsOfServiceContent } from '../types/legal';
import { privacyEnglish } from './legal/privacyEn';
import { privacyPortugueseBrazil } from './legal/privacyPtBR';
import { termsEnglish } from './legal/termsEn';
import { termsPortugueseBrazil } from './legal/termsPtBR';

export const privacyContent: Record<Locale, PrivacyPolicyContent> = {
  en: privacyEnglish,
  'pt-BR': privacyPortugueseBrazil,
};

export const termsContent: Record<Locale, TermsOfServiceContent> = {
  en: termsEnglish,
  'pt-BR': termsPortugueseBrazil,
};
