import { IndentIncrease, IndentDecrease } from 'lucide-react';
import type { ContextMenuItem } from './ui/ContextMenu';
import type { TaskIndentMenuContext, TaskIndentHandler } from '../types/taskIndent';
import type { TranslationKey } from '../i18n/catalogs';
import { resolveTaskIndent } from '../utils/taskIndent';

export function buildIndentMenuItems(
  t: (key: TranslationKey) => string,
  context: TaskIndentMenuContext,
  onIndent: TaskIndentHandler,
): ContextMenuItem[] {
  const { taskId, visibleTasks, scope } = context;
  if (!visibleTasks || !scope) return [];
  return [
    {
      type: 'item', label: t('contextMenu.indent'), icon: <IndentIncrease size={14} />,
      disabled: !resolveTaskIndent(visibleTasks, taskId, 1, scope),
      onClick: () => onIndent(taskId, 1, visibleTasks, scope),
    },
    {
      type: 'item', label: t('contextMenu.unindent'), icon: <IndentDecrease size={14} />,
      disabled: !resolveTaskIndent(visibleTasks, taskId, -1, scope),
      onClick: () => onIndent(taskId, -1, visibleTasks, scope),
    },
  ];
}
