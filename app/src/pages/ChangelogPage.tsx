import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ChangelogMarkdown } from '../components/changelog/ChangelogMarkdown';
import { useI18n } from '../i18n/I18nContext';
import { CHANGELOG_MARKDOWN } from '../utils/changelog';
import { parseChangelogMarkdown } from '../utils/changelogMarkdown';
import { APP_VERSION } from '../utils/version';

export function ChangelogPage({ markdown = CHANGELOG_MARKDOWN }: { markdown?: string }) {
  const { t } = useI18n();
  const document = useMemo(() => parseChangelogMarkdown(markdown), [markdown]);
  const isEmpty = document.intro.length === 0 && document.sections.length === 0;

  return (
    <div className="changelog-page w-full pb-24 text-ink">
      <PageHeader
        title={t('changelog.title')}
        afterTitle={
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light">
            {t('nav.version', { version: APP_VERSION })}
          </p>
        }
      />
      <div className="h-6" />

      {isEmpty ? (
        <p className="m-0 text-[14px] leading-6 text-ink-light italic">{t('changelog.empty')}</p>
      ) : (
        <ChangelogMarkdown document={document} />
      )}
    </div>
  );
}
