import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiCreateTask, apiRenameTask, apiSetTaskCompleted, fetchTaskDetail } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { closeTaskDetails, openTaskDetails, setDetailMode, useTaskDetailStore } from '../../stores/taskDetailStore';
import { getSocket, getSocketId } from '../../utils/socket';
import { referencedTaskIds } from '../../utils/documentContent';
import { embeddedCoverage, flattenSubtree, leafProgress } from '../../utils/subtree';
import { DetailFrame } from './DetailFrame';
import { DetailHeader } from './DetailHeader';
import { DetailProperties } from './DetailProperties';
import { DetailDocument, SaveStateLabel } from './DetailDocument';
import { DetailTaskRows } from './DetailTaskRows';
import { DetailActivity } from './DetailActivity';
import type { SyncEvent } from '../../contracts/sync';
import type { DetailLayout, DetailMode } from '../../types/detail';
import './detailPanel.css';
import './detailContent.css';
import './detailEditor.css';
import './detailSheet.css';

export function taskDetailQueryKey(taskId: string) {
  return ['task-detail', taskId] as const;
}

/**
 * Every task change refreshes the open item, this tab's own included: a row
 * completed in the list behind the panel must show here too.
 */
function useDetailRefresh() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const onSync = (event: SyncEvent) => {
      if (event.entityType === 'task') {
        const selfId = getSocketId();
        if (selfId && event.sourceId === selfId && event.eventType === 'updated') return;
        void qc.invalidateQueries({ queryKey: ['task-detail'] });
      } else if (event.entityType === 'status') {
        void qc.invalidateQueries({ queryKey: ['statuses'] });
      }
    };
    socket.on('sync', onSync);
    return () => {
      socket.off('sync', onSync);
    };
  }, [qc]);
}

function DetailBody({ taskId, layout, mode, onModeChange }: { taskId: string; layout: DetailLayout; mode: DetailMode; onModeChange: (mode: DetailMode) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: taskDetailQueryKey(taskId),
    queryFn: () => fetchTaskDetail(taskId),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });
  const draft = useDocumentDraft(taskId);
  const { status, draft: unsaved } = draft.state;
  const draftReady = draft.view.key > 0 || unsaved !== null;

  useEffect(() => {
    const failed = unsaved !== null && (status === 'error' || status === 'conflict');
    useTaskDetailStore.setState({ leaveGuard: failed ? () => window.confirm(t('detail.leaveConfirm')) : null });
    if (unsaved === null) return () => useTaskDetailStore.setState({ leaveGuard: null });
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      useTaskDetailStore.setState({ leaveGuard: null });
    };
  }, [status, unsaved, t]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['task-detail'] });
  const toggle = (id: string, completed: boolean) => {
    void apiSetTaskCompleted(id, completed).catch(() => {}).finally(refresh);
  };

  // A refetch that fails keeps the old data, which is how a deletion is told apart from a bad link.
  const missing = query.error instanceof ApiError && query.error.status === 404;
  if (!query.data || missing) {
    const message = query.isPending ? t('detail.loading') : missing ? t(query.data ? 'detail.deleted' : 'detail.notFound') : t('detail.loadFailed');
    return (
      <div className="detail-state">
        <div className="detail-header-top detail-header-top--bare">
          <span className="detail-breadcrumb" />
          <CloseOnly />
        </div>
        <p role={query.isPending ? 'status' : 'alert'} className="detail-state-text">{message}</p>
        {!query.isPending && !missing && <button type="button" className="detail-button" onClick={() => void query.refetch()}>{t('detail.retry')}</button>}
      </div>
    );
  }

  const detail = query.data;
  const rows = flattenSubtree(detail.task.id, detail.descendants);
  const progress = leafProgress(detail.task.id, detail.descendants);
  const embedded = referencedTaskIds(unsaved ?? draft.state.base?.content ?? draft.view.content ?? { type: 'doc' });
  const covered = embeddedCoverage(embedded, detail.descendants);
  const otherRows = rows.filter((row) => !covered.has(row.item.id));
  const references = {
    items: new Map(detail.descendants.map((entry) => [entry.id, entry])),
    embedded,
    onToggle: toggle,
    onOpen: (id: string) => openTaskDetails(id, { focusPanel: true }),
  };
  const createTask = async (title: string) => {
    const created = await apiCreateTask({ title, collectionId: detail.task.collectionId, parentTaskId: taskId });
    await refresh();
    return created.id;
  };

  return (
    <>
      <DetailHeader
        detail={detail}
        layout={layout}
        mode={mode}
        onModeChange={onModeChange}
        progress={progress}
        saveState={<SaveStateLabel status={status} ready={draftReady} />}
        onRename={(title) => void apiRenameTask(taskId, title).catch(() => {}).finally(refresh)}
        onToggle={() => toggle(taskId, !detail.task.isCompleted)}
      />
      <div className="detail-body">
        {mode === 'tasks' ? (
          <section className="detail-section" aria-label={t('detail.subtasks')}>
            {rows.length === 0 ? <p className="detail-muted detail-empty">{t('detail.noSubtasks')}</p> : <DetailTaskRows rows={rows} onToggle={toggle} outsideText={new Set(otherRows.map((row) => row.item.id))} />}
          </section>
        ) : (
          <>
            <DetailProperties task={detail.task} progress={progress} claim={detail.claim} />
            <DetailDocument draft={draft} title={detail.task.title} references={references} onCreateTask={createTask} />
            {otherRows.length > 0 && (
              <section className="detail-section detail-section--compact" aria-labelledby="detail-other-subtasks">
                <h3 id="detail-other-subtasks" className="detail-section-label">{t('detail.otherSubtasks')}</h3>
                <DetailTaskRows rows={otherRows} onToggle={toggle} />
              </section>
            )}
            <DetailActivity taskId={taskId} />
          </>
        )}
      </div>
    </>
  );
}

function CloseOnly() {
  const { t } = useI18n();
  return (
    <button type="button" className="detail-close" aria-label={t('detail.close')} onClick={() => closeTaskDetails()}>
      <X size={16} aria-hidden="true" />
    </button>
  );
}

export default function TaskDetailPanel({ taskId, layout }: { taskId: string; layout: DetailLayout }) {
  const { t } = useI18n();
  const mode = useTaskDetailStore((state) => state.mode);
  useDetailRefresh();
  return (
    <DetailFrame layout={layout} label={t('detail.panel')}>
      <DetailBody key={taskId} taskId={taskId} layout={layout} mode={mode} onModeChange={setDetailMode} />
    </DetailFrame>
  );
}
