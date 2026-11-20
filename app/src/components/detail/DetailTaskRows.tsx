import { useI18n } from '../../i18n/I18nContext';
import { openTaskDetails } from '../../stores/taskDetailStore';
import { TaskCheck } from './TaskCheck';
import type { TaskDetailItem } from '../../contracts/taskDetail';
import type { SubtreeRow } from '../../types/detail';

/** The check (or note marker) and the title that opens the subtask; shared by list rows and embedded blocks. */
export function TaskRowContent({ item, onToggle, onOpen }: { item: TaskDetailItem; onToggle: (id: string, completed: boolean) => void; onOpen?: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <>
      {item.type === 'task' ? (
        <TaskCheck checked={item.isCompleted} label={item.title} size="small" onToggle={() => onToggle(item.id, !item.isCompleted)} />
      ) : (
        <span className="detail-row-marker" aria-hidden="true">{item.type === 'note' ? '-' : '○'}</span>
      )}
      <button
        type="button"
        className="detail-row-title"
        aria-label={t('detail.openSubtask', { title: item.title })}
        onClick={() => (onOpen ?? ((id) => openTaskDetails(id, { focusPanel: true })))(item.id)}
      >
        {item.title}
      </button>
    </>
  );
}

/** Subtask rows: 28px, square 12px checkbox that only completes, title that opens the subtask. */
export function DetailTaskRows({ rows, onToggle }: { rows: SubtreeRow[]; onToggle: (id: string, completed: boolean) => void }) {
  return (
    <ul className="detail-rows">
      {rows.map(({ item, depth }) => (
        <li key={item.id} className={`detail-row ${item.isCompleted ? 'is-complete' : ''}`} style={{ paddingInlineStart: `${depth * 24}px` }}>
          <TaskRowContent item={item} onToggle={onToggle} />
        </li>
      ))}
    </ul>
  );
}
