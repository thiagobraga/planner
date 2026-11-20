import { useId } from 'react';
import type { TaskReferenceContextValue } from '../../types/detail';
import { useI18n } from '../../i18n/I18nContext';
import { hasUnsupportedNodes, toMarkdown } from '../../utils/documentContent';
import { DocumentEditor } from './DocumentEditor';
import { TaskReferenceContext } from './TaskReferenceContext';
import type { useDocumentDraft } from '../../hooks/useDocumentDraft';
import type { SaveStatus } from '../../types/detail';
import type { TranslationKey } from '../../i18n/catalogs';

type Draft = ReturnType<typeof useDocumentDraft>;

const STATUS_LABEL: Record<SaveStatus, TranslationKey> = {
  saved: 'detail.saved', dirty: 'detail.unsaved', saving: 'detail.saving', error: 'detail.saveFailed', conflict: 'detail.conflict',
};

export function SaveStateLabel({ status, ready = true }: { status: SaveStatus; ready?: boolean }) {
  const { t } = useI18n();
  if (!ready && status === 'saved') return null;
  const hasAlertBanner = status === 'error' || status === 'conflict';
  return (
    <span role={hasAlertBanner ? undefined : 'status'} className={`detail-save-text is-${status}`}>
      {t(STATUS_LABEL[status])}
    </span>
  );
}

function downloadDraft(draft: Draft, title: string, titles: ReadonlyMap<string, string>) {
  const content = draft.state.draft ?? draft.state.base?.content ?? draft.view.content;
  if (!content) return;
  const blob = new Blob([`# ${title}\n\n${toMarkdown(content, titles)}`], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'draft'}.md`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface DetailDocumentProps {
  draft: Draft;
  title: string;
  references: TaskReferenceContextValue;
  onCreateTask: (title: string) => Promise<string>;
}

export function DetailDocument({ draft, title, references, onCreateTask }: DetailDocumentProps) {
  const { t } = useI18n();
  const labelId = useId();
  const { state, view, query } = draft;
  const currentContent = state.draft ?? state.base?.content ?? view.content;
  const ready = view.key > 0 || state.draft !== null;
  const readOnly = Boolean(query.data && hasUnsupportedNodes(query.data.content));
  const titles = new Map([...references.items.values()].map((entry) => [entry.id, entry.title]));

  return (
    <section className="detail-section detail-document" aria-labelledby={labelId}>
      <h3 id={labelId} className="sr-only">{t('detail.description')}</h3>
      {state.status === 'conflict' && (
        <div className="detail-notice" role="alert">
          <span>{t('detail.conflict')}</span>
          <button type="button" className="detail-button" onClick={draft.reload}>{t('detail.conflictReload')}</button>
          <button type="button" className="detail-button" onClick={draft.keepMine}>{t('detail.conflictKeep')}</button>
          <button type="button" className="detail-button" onClick={() => downloadDraft(draft, title, titles)}>{t('detail.downloadDraft')}</button>
        </div>
      )}
      {state.status === 'error' && (
        <div className="detail-notice" role="alert">
          <span>{t('detail.saveFailed')}</span>
          <button type="button" className="detail-button" onClick={() => void draft.save()}>{t('detail.saveRetry')}</button>
          <button type="button" className="detail-button" onClick={() => downloadDraft(draft, title, titles)}>{t('detail.downloadDraft')}</button>
        </div>
      )}
      {readOnly && <p className="detail-muted">{t('detail.readOnly')}</p>}
      {query.isError && !ready ? (
        <div className="detail-notice" role="alert">
          <span>{t('detail.loadFailed')}</span>
          <button type="button" className="detail-button" onClick={() => void query.refetch()}>{t('detail.retry')}</button>
        </div>
      ) : ready && readOnly && currentContent ? (
        <pre className="detail-prose detail-prose--readonly" aria-labelledby={labelId}>{toMarkdown(currentContent, titles).trim()}</pre>
      ) : ready ? (
        <TaskReferenceContext.Provider value={references}>
          <DocumentEditor version={view.key} content={currentContent} readOnly={readOnly} labelledBy={labelId} onEdit={draft.edit} onCreateTask={onCreateTask} />
        </TaskReferenceContext.Provider>
      ) : (
        <p className="detail-muted">{t('detail.loading')}</p>
      )}
    </section>
  );
}
