import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react';
import { TaskReferenceView } from './TaskReferenceView';

/** The `taskReference` block the server allowlist reserves: it stores a task id and a block id, nothing else. */
export const TaskReference = Node.create({
  name: 'taskReference',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { taskId: { default: null }, blockId: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'div[data-task-reference]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-task-reference': '' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TaskReferenceView);
  },
});
