import { useI18n } from '../i18n/I18nContext';
import { privacyContent } from '../i18n/legalContent';
import { LegalLayout, LegalProseSection, LegalSectionHeading } from '../components/LegalLayout';

export function PrivacyPage() {
  const { locale } = useI18n();
  const content = privacyContent[locale];

  const toc = [
    { id: content.introSection.id, title: content.introSection.title },
    { id: content.dataCollectionSection.id, title: content.dataCollectionSection.title },
    { id: content.dataNotCollectedSection.id, title: content.dataNotCollectedSection.title },
    { id: content.thirdPartySection.id, title: content.thirdPartySection.title },
    { id: content.cookiePolicySection.id, title: content.cookiePolicySection.title },
    { id: content.userRightsSection.id, title: content.userRightsSection.title },
    { id: content.retentionSection.id, title: content.retentionSection.title },
    { id: content.securitySection.id, title: content.securitySection.title },
    { id: content.contactSection.id, title: content.contactSection.title },
  ];

  return (
    <LegalLayout
      title={content.title}
      subtitle={content.subtitle}
      lastUpdated={content.lastUpdated}
      onThisPage={content.onThisPage}
      backToPlanner={content.backToPlanner}
      toc={toc}
    >
      <LegalProseSection section={content.introSection} />

      <section id={content.dataCollectionSection.id} className="mb-12">
        <LegalSectionHeading title={content.dataCollectionSection.title} />
        <p className="mb-4 text-sm leading-6 text-ink">{content.dataCollectionSection.intro}</p>
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full text-left border-collapse text-[13px] leading-6">
            <thead>
              <tr className="border-b border-border bg-[var(--planner-sidebar-bg)] text-ink-light">
                <th className="py-2 px-3 font-medium">{content.dataCollectionSection.headers.category}</th>
                <th className="py-2 px-3 font-medium">{content.dataCollectionSection.headers.source}</th>
                <th className="py-2 px-3 font-medium">{content.dataCollectionSection.headers.purpose}</th>
                <th className="py-2 px-3 font-medium">{content.dataCollectionSection.headers.gdprBasis}</th>
                <th className="py-2 px-3 font-medium">{content.dataCollectionSection.headers.lgpdBasis}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {content.dataCollectionSection.rows.map((row) => (
                <tr key={row.category}>
                  <td className="py-2 px-3 font-medium text-ink">{row.category}</td>
                  <td className="py-2 px-3 text-ink-light">{row.source}</td>
                  <td className="py-2 px-3 text-ink">{row.purpose}</td>
                  <td className="py-2 px-3 text-ink-light">{row.gdprBasis}</td>
                  <td className="py-2 px-3 text-ink-light">{row.lgpdBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-ink-light">
          {content.dataCollectionSection.consentNote}
        </p>
      </section>

      <LegalProseSection section={content.dataNotCollectedSection} />

      <section id={content.thirdPartySection.id} className="mb-12">
        <LegalSectionHeading title={content.thirdPartySection.title} />
        <p className="mb-4 text-sm leading-6 text-ink">{content.thirdPartySection.intro}</p>
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full text-left border-collapse text-[13px] leading-6">
            <thead>
              <tr className="border-b border-border bg-[var(--planner-sidebar-bg)] text-ink-light">
                <th className="py-2 px-3 font-medium">{content.thirdPartySection.headers.thirdParty}</th>
                <th className="py-2 px-3 font-medium">{content.thirdPartySection.headers.dataReceived}</th>
                <th className="py-2 px-3 font-medium">{content.thirdPartySection.headers.purpose}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {content.thirdPartySection.rows.map((row) => (
                <tr key={row.thirdParty}>
                  <td className="py-2 px-3 font-medium text-ink">{row.thirdParty}</td>
                  <td className="py-2 px-3 text-ink">{row.dataReceived}</td>
                  <td className="py-2 px-3 text-ink-light">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id={content.cookiePolicySection.id} className="mb-12">
        <LegalSectionHeading title={content.cookiePolicySection.title} />
        <p className="mb-4 text-sm leading-6 text-ink">{content.cookiePolicySection.intro}</p>
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full text-left border-collapse text-[13px] leading-6">
            <thead>
              <tr className="border-b border-border bg-[var(--planner-sidebar-bg)] text-ink-light">
                <th className="py-2 px-3 font-medium">{content.cookiePolicySection.headers.name}</th>
                <th className="py-2 px-3 font-medium">{content.cookiePolicySection.headers.type}</th>
                <th className="py-2 px-3 font-medium">{content.cookiePolicySection.headers.purpose}</th>
                <th className="py-2 px-3 font-medium">{content.cookiePolicySection.headers.duration}</th>
                <th className="py-2 px-3 font-medium">{content.cookiePolicySection.headers.consentRequired}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {content.cookiePolicySection.rows.map((row) => (
                <tr key={row.name}>
                  <td className="py-2 px-3 font-mono text-[12px] text-ink">{row.name}</td>
                  <td className="py-2 px-3 text-ink">{row.type}</td>
                  <td className="py-2 px-3 text-ink">{row.purpose}</td>
                  <td className="py-2 px-3 text-ink-light">{row.duration}</td>
                  <td className="py-2 px-3 text-ink-light">{row.consentRequired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink">{content.cookiePolicySection.noBannerNotice}</p>
        <p className="mt-2 text-[13px] leading-6 text-ink-light">{content.cookiePolicySection.googleCookieNote}</p>
      </section>

      <section id={content.userRightsSection.id} className="mb-12">
        <LegalSectionHeading title={content.userRightsSection.title} />
        <p className="mb-4 text-sm leading-6 text-ink">{content.userRightsSection.intro}</p>
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full text-left border-collapse text-[13px] leading-6">
            <thead>
              <tr className="border-b border-border bg-[var(--planner-sidebar-bg)] text-ink-light">
                <th className="py-2 px-3 font-medium">{content.userRightsSection.headers.right}</th>
                <th className="py-2 px-3 font-medium">{content.userRightsSection.headers.implementation}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {content.userRightsSection.rows.map((row) => (
                <tr key={row.right}>
                  <td className="py-2 px-3 font-medium text-ink">{row.right}</td>
                  <td className="py-2 px-3 text-ink">{row.implementation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <LegalProseSection section={content.retentionSection} />
      <LegalProseSection section={content.securitySection} />
      <LegalProseSection section={content.contactSection} />
    </LegalLayout>
  );
}
