import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useI18n } from '../../i18n/I18nContext';
import { TaskRowContent } from './DetailTaskRows';
import { useTaskReferences } from './TaskReferenceContext';

/** A task embedded in the text: a live row read from the subtree, not a copy. */
export function TaskReferenceView({ node }: NodeViewProps) {
  const { t } = useI18n();
  const { items, onToggle, onOpen } = useTaskReferences();
  const item = items.get(String(node.attrs.taskId));
  return (
    <NodeViewWrapper className="detail-task-block" data-task-id={String(node.attrs.taskId)}>
      <div className={`detail-row ${item?.isCompleted ? 'is-complete' : ''}`} contentEditable={false}>
        {item ? <TaskRowContent item={item} onToggle={onToggle} onOpen={onOpen} /> : <span className="detail-muted">{t('detail.taskUnavailable')}</span>}
      </div>
    </NodeViewWrapper>
  );
}
