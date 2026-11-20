import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCollections, fetchStatuses } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { formatDueDate } from '../../utils/formatDueDate';
import type { TaskDetailItem } from '../../contracts/taskDetail';
import type { TranslationKey } from '../../i18n/catalogs';

const TYPE_LABEL: Record<TaskDetailItem['type'], TranslationKey> = { task: 'detail.typeTask', note: 'detail.typeNote', event: 'detail.typeEvent' };

/** Status, collection and progress up front; the rest waits behind "More properties". */
export function DetailProperties({ task, progress }: { task: TaskDetailItem; progress: { done: number; total: number } }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();
  const { data: collections } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const { data: statuses } = useQuery({ queryKey: ['statuses', task.collectionId], queryFn: () => fetchStatuses(task.collectionId) });
  const collection = collections?.find((item) => item.id === task.collectionId);
  const status = statuses?.find((item) => item.id === task.statusId);
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const date = (value: string | null) => (value ? formatDueDate(value, locale) : <span className="detail-muted">{t('detail.notSet')}</span>);

  return (
    <section className="detail-properties" aria-label={t('detail.properties')}>
      <dl>
        {status && (
          <>
            <dt>{t('detail.status')}</dt>
            <dd><span className="detail-status-pill"><span aria-hidden="true" style={{ backgroundColor: status.color }} />{status.name}</span></dd>
          </>
        )}
        <dt>{t('detail.collection')}</dt>
        <dd>{collection?.name ?? <span className="detail-muted">…</span>}</dd>
        <dt>{t('detail.progress')}</dt>
        <dd>{progress.total === 0
          ? <span className="detail-muted">{t('detail.noSubtasks')}</span>
          : t('detail.progressValue', { done: progress.done, total: progress.total, percent })}
        </dd>
      </dl>
      {expanded && (
        <dl id={moreId}>
          <dt>{t('detail.type')}</dt>
          <dd>{t(TYPE_LABEL[task.type])}</dd>
          <dt>{t('detail.dueDate')}</dt>
          <dd>{date(task.dueDate)}</dd>
          <dt>{t('detail.deadline')}</dt>
          <dd>{date(task.deadlineDate)}</dd>
          <dt>{t('detail.priority')}</dt>
          <dd>{task.priority < 4 ? `P${task.priority}` : <span className="detail-muted">{t('detail.notSet')}</span>}</dd>
        </dl>
      )}
      <button type="button" className="detail-text-button" aria-expanded={expanded} aria-controls={expanded ? moreId : undefined} onClick={() => setExpanded((value) => !value)}>
        {expanded ? t('detail.fewerProperties') : t('detail.moreProperties')}
      </button>
    </section>
  );
}
