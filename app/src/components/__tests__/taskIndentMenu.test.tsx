import { describe, expect, it, vi } from 'vitest';
import { buildIndentMenuItems } from '../taskIndentMenu';
import type { Task } from '../TaskItem';
import type { TaskIndentMenuContext } from '../../types/taskIndent';

const row = (id: string, orderValue: number, parentTaskId?: string): Task => ({
  id, title: id, priority: 4, isCompleted: false, orderValue, parentTaskId,
  collectionId: 'c1', sectionId: 's1', type: 'task',
});
const context = (visibleTasks: Task[], taskId: string): TaskIndentMenuContext => ({
  taskId, visibleTasks, position: { x: 0, y: 0 }, scope: { kind: 'section', sectionId: 's1' },
});
const t = (key: string) => key;

describe('task indent menu', () => {
  it('keeps both actions visible and disabled for a lone task', () => {
    const items = buildIndentMenuItems(t, context([row('a', 0)], 'a'), vi.fn());
    expect(items.map((item) => item.label)).toEqual(['contextMenu.indent', 'contextMenu.unindent']);
    expect(items.map((item) => item.disabled)).toEqual([true, true]);
  });

  it('enables indent for the second root and unindent for its child', () => {
    const tasks = [row('a', 0), row('b', 1000)];
    expect(buildIndentMenuItems(t, context(tasks, 'b'), vi.fn()).map((item) => item.disabled)).toEqual([false, true]);
    const child = [row('a', 0), row('b', 0, 'a')];
    expect(buildIndentMenuItems(t, context(child, 'b'), vi.fn()).map((item) => item.disabled)).toEqual([true, false]);
  });
});
