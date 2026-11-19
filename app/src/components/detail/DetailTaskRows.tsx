import { useI18n } from '../../i18n/I18nContext';
import { openTaskDetails } from '../../stores/taskDetailStore';
import { TaskCheck } from './TaskCheck';
import type { SubtreeRow } from '../../types/detail';

/** Subtask rows: 28px, square 12px checkbox that only completes, title that opens the subtask. */
export function DetailTaskRows({ rows, onToggle }: { rows: SubtreeRow[]; onToggle: (id: string, completed: boolean) => void }) {
  const { t } = useI18n();
  return (
    <ul className="detail-rows">
      {rows.map(({ item, depth }) => (
        <li key={item.id} className={`detail-row ${item.isCompleted ? 'is-complete' : ''}`} style={{ paddingInlineStart: `${Math.min(depth, 6) * 24}px` }}>
          {item.type === 'task' ? (
            <TaskCheck checked={item.isCompleted} label={item.title} size="small" onToggle={() => onToggle(item.id, !item.isCompleted)} />
          ) : (
            <span className="detail-row-marker" aria-hidden="true">{item.type === 'note' ? '-' : '○'}</span>
          )}
          <button
            type="button"
            className="detail-row-title"
            aria-label={t('detail.openSubtask', { title: item.title })}
            onClick={() => openTaskDetails(item.id, { focusPanel: true })}
          >
            {item.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
