import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useI18n } from '../../i18n/I18nContext';
import { leafProgress, subtreeWithout } from '../../utils/subtree';
import { TaskRowContent } from './DetailTaskRows';
import { useTaskReferences } from './TaskReferenceContext';

/**
 * A task embedded in the text: a live row read from the subtree, not a copy,
 * followed by its own subtasks so the plan reads as one tree.
 */
export function TaskReferenceView({ node }: NodeViewProps) {
  const { t } = useI18n();
  const { items, embedded, onToggle, onOpen } = useTaskReferences();
  const taskId = String(node.attrs.taskId);
  const item = items.get(taskId);
  const all = [...items.values()];
  const others = new Set([...embedded].filter((id) => id !== taskId));
  const nested = item ? subtreeWithout(taskId, all, others) : [];
  const progress = nested.length > 0 ? leafProgress(taskId, all) : null;
  return (
    <NodeViewWrapper className="detail-task-block" data-task-id={taskId}>
      <div className={`detail-row ${item?.isCompleted ? 'is-complete' : ''}`} contentEditable={false}>
        {item ? <TaskRowContent item={item} onToggle={onToggle} onOpen={onOpen} /> : <span className="detail-muted">{t('detail.taskUnavailable')}</span>}
        {progress && progress.total > 0 && <span className="detail-row-meta">{t('board.progressCount', { done: progress.done, total: progress.total })}</span>}
      </div>
      {nested.map(({ item: child, depth }) => (
        <div
          key={child.id}
          className={`detail-row ${child.isCompleted ? 'is-complete' : ''}`}
          style={{ paddingInlineStart: `${(depth + 1) * 24}px` }}
          contentEditable={false}
        >
          <TaskRowContent item={child} onToggle={onToggle} onOpen={onOpen} />
        </div>
      ))}
    </NodeViewWrapper>
  );
}
