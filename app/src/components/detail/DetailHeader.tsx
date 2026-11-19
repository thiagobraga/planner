import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { closeTaskDetails, openTaskDetails } from '../../stores/taskDetailStore';
import { TaskCheck } from './TaskCheck';
import type { TaskDetailDto } from '../../contracts/taskDetail';
import type { DetailLayout, DetailMode } from '../../types/detail';

interface DetailHeaderProps {
  detail: TaskDetailDto;
  layout: DetailLayout;
  mode: DetailMode;
  onModeChange: (mode: DetailMode) => void;
  saveState: ReactNode;
  progress: { done: number; total: number };
  onRename: (title: string) => void;
  onToggle: () => void;
  titleId?: string;
}

export function DetailHeader({ detail, layout, mode, onModeChange, saveState, progress, onRename, onToggle, titleId }: DetailHeaderProps) {
  const { t } = useI18n();
  const { task, ancestors } = detail;
  // null while not editing, so a rename from elsewhere shows through.
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const skipCommitRef = useRef(false);
  const title = draftTitle ?? task.title;
  const parent = ancestors.at(-1);

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setDraftTitle(null);
      return;
    }
    const next = title.trim();
    if (next && next !== task.title) onRename(next);
    setDraftTitle(null);
  };

  return (
    <header className="detail-header">
      <div className="detail-header-top">
        {layout === 'sheet' && parent ? (
          <button type="button" className="detail-back" onClick={() => openTaskDetails(parent.id, { focusPanel: true })}>
            <ChevronLeft size={16} aria-hidden="true" />
            <span>{t('detail.back', { title: parent.title })}</span>
          </button>
        ) : ancestors.length > 0 ? (
          <nav className="detail-breadcrumb" aria-label={t('detail.parents')}>
            {ancestors.map((ancestor, index) => (
              <span key={ancestor.id} className="detail-breadcrumb-item">
                {index > 0 && <span aria-hidden="true" className="detail-breadcrumb-sep">›</span>}
                <button type="button" onClick={() => openTaskDetails(ancestor.id, { focusPanel: true })}>{ancestor.title}</button>
              </span>
            ))}
          </nav>
        ) : <span className="detail-breadcrumb" />}
        <span className="detail-save-state">{saveState}</span>
        <button type="button" className="detail-close" aria-label={t('detail.close')} onClick={() => closeTaskDetails()}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="detail-title-row">
        {task.type === 'task' && (
          <TaskCheck checked={task.isCompleted} label={task.title} size="large" onToggle={onToggle} />
        )}
        <h2 id={titleId} className="sr-only">{task.title}</h2>
        <textarea
          className={`detail-title ${task.isCompleted ? 'is-complete' : ''}`}
          aria-label={t('detail.titleLabel')}
          rows={1}
          value={title}
          maxLength={500}
          onChange={(event) => {
            skipCommitRef.current = false;
            setDraftTitle(event.target.value.replace(/\n/g, ' '));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              skipCommitRef.current = true;
              setDraftTitle(null);
              event.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="detail-mode-row">
        <div className="detail-mode" role="radiogroup" aria-label={t('detail.mode')}>
          {(['full', 'tasks'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => onModeChange(value)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const next = value === 'full' ? 'tasks' : 'full';
                onModeChange(next);
                (event.currentTarget.parentElement?.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus();
              }}
              data-mode={value}
            >
              {value === 'full' ? t('detail.modeFull') : t('detail.modeTasks')}
            </button>
          ))}
        </div>
        {mode === 'tasks' && <ProgressSummary progress={progress} />}
      </div>
    </header>
  );
}

export function ProgressSummary({ progress }: { progress: { done: number; total: number } }) {
  const { t } = useI18n();
  if (progress.total === 0) return <span className="detail-progress-text">{t('detail.noSubtasks')}</span>;
  return (
    <span className="detail-progress">
      <span className="detail-progress-text">{t('detail.progressDone', { done: progress.done, total: progress.total })}</span>
      <span
        className="detail-progress-bar"
        role="progressbar"
        aria-label={t('detail.progress')}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
      </span>
    </span>
  );
}
