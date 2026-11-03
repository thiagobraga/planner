import { useI18n } from '../i18n/I18nContext';
import { termsContent } from '../i18n/legalContent';
import { LegalLayout, LegalProseSection } from '../components/LegalLayout';

export function TermsPage() {
  const { locale } = useI18n();
  const content = termsContent[locale];

  const toc = content.sections.map((section) => ({
    id: section.id,
    title: section.title,
  }));

  return (
    <LegalLayout
      title={content.title}
      subtitle={content.subtitle}
      lastUpdated={content.lastUpdated}
      onThisPage={content.onThisPage}
      backToPlanner={content.backToPlanner}
      toc={toc}
    >
      {content.sections.map((section) => (
        <LegalProseSection key={section.id} section={section} />
      ))}
    </LegalLayout>
  );
}
