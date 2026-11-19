import { useId } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { hasUnsupportedNodes, toMarkdown } from '../../utils/documentContent';
import { DocumentEditor } from './DocumentEditor';
import type { useDocumentDraft } from '../../hooks/useDocumentDraft';
import type { SaveStatus } from '../../types/detail';
import type { TranslationKey } from '../../i18n/catalogs';

type Draft = ReturnType<typeof useDocumentDraft>;

const STATUS_LABEL: Record<SaveStatus, TranslationKey> = {
  saved: 'detail.saved', dirty: 'detail.unsaved', saving: 'detail.saving', error: 'detail.saveFailed', conflict: 'detail.conflict',
};

export function SaveStateLabel({ status }: { status: SaveStatus }) {
  const { t } = useI18n();
  return <span role="status" className={`detail-save-text is-${status}`}>{t(STATUS_LABEL[status])}</span>;
}

function downloadDraft(draft: Draft, title: string) {
  const content = draft.state.draft ?? draft.view.content;
  if (!content) return;
  const blob = new Blob([`# ${title}\n\n${toMarkdown(content)}`], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `${title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'draft'}.md` });
  link.click();
  URL.revokeObjectURL(url);
}

export function DetailDocument({ draft, title }: { draft: Draft; title: string }) {
  const { t } = useI18n();
  const labelId = useId();
  const { state, view, query } = draft;
  const ready = view.key > 0 || state.draft !== null;
  const readOnly = Boolean(query.data && hasUnsupportedNodes(query.data.content));

  return (
    <section className="detail-section detail-document" aria-labelledby={labelId}>
      <h3 id={labelId} className="sr-only">{t('detail.description')}</h3>
      {state.status === 'conflict' && (
        <div className="detail-notice" role="alert">
          <span>{t('detail.conflict')}</span>
          <button type="button" className="detail-button" onClick={draft.reload}>{t('detail.conflictReload')}</button>
          <button type="button" className="detail-button" onClick={draft.keepMine}>{t('detail.conflictKeep')}</button>
        </div>
      )}
      {state.status === 'error' && (
        <div className="detail-notice" role="alert">
          <span>{t('detail.saveFailed')}</span>
          <button type="button" className="detail-button" onClick={() => void draft.save()}>{t('detail.saveRetry')}</button>
          <button type="button" className="detail-button" onClick={() => downloadDraft(draft, title)}>{t('detail.downloadDraft')}</button>
        </div>
      )}
      {readOnly && <p className="detail-muted">{t('detail.readOnly')}</p>}
      {query.isError && !ready ? (
        <div className="detail-notice" role="alert">
          <span>{t('detail.loadFailed')}</span>
          <button type="button" className="detail-button" onClick={() => void query.refetch()}>{t('detail.retry')}</button>
        </div>
      ) : ready ? (
        <DocumentEditor version={view.key} content={view.content} readOnly={readOnly} labelledBy={labelId} onEdit={draft.edit} />
      ) : (
        <p className="detail-muted">{t('detail.loading')}</p>
      )}
    </section>
  );
}
