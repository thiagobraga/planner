import { lazy, Suspense } from 'react';
import { useDetailLayout, useTaskDetailController } from '../../hooks/useTaskDetailController';
import { useI18n } from '../../i18n/I18nContext';
import './detailShell.css';

// The first lazy chunk: the panel and the Tiptap editor stay out of the
// initial bundle until someone opens an item.
const TaskDetailPanel = lazy(() => import('./TaskDetailPanel'));

export function TaskDetailHost() {
  const taskId = useTaskDetailController();
  const layout = useDetailLayout();
  const { t } = useI18n();
  if (!taskId) return null;
  return (
    <Suspense
      fallback={(
        <>
          {layout === 'sheet' && <div className="detail-sheet-scrim" aria-hidden="true" />}
          <aside className={`detail-panel detail-panel--${layout}`} aria-label={t('detail.panel')} aria-busy="true">
            <p className="detail-panel-fallback">{t('detail.loading')}</p>
          </aside>
        </>
      )}
    >
      <TaskDetailPanel taskId={taskId} layout={layout} />
    </Suspense>
  );
}
