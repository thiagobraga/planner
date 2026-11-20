import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import type { Task } from '../../types/task';
import { useInboxTaskRows } from '../useInboxTaskRows';

const deleteTask = vi.fn(() => Promise.resolve());
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiDeleteTask: (id: string) => deleteTask(id),
}));

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, isCompleted: false, orderValue: 0, ...extra } as Task);
const tasks = [task('plan'), task('child', { parentTaskId: 'plan' }), task('notes', { description: 'Goal' }), task('plain')];

function setup() {
  let current = tasks;
  const setTasks = vi.fn((next: Task[] | ((prev: Task[]) => Task[])) => {
    current = typeof next === 'function' ? next(current) : next;
  });
  const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;
  const hook = renderHook(() => useInboxTaskRows({
    tasks, tasksRef: { current: tasks }, setTasks, setEditingId: vi.fn(), setSelectedId: vi.fn(), setIndentError: vi.fn(),
    invalidate: () => Promise.resolve(), locale: 'en', hideCompletedTasks: false, includeCompleted: false,
  }), { wrapper });
  return { hook, rows: () => current };
}

beforeEach(() => deleteTask.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe('useInboxTaskRows deletion guard', () => {
  it('drops an empty rename on a task with subtasks or notes instead of deleting it', () => {
    const { hook, rows } = setup();
    act(() => hook.result.current.handleEditCommit('plan', ''));
    act(() => hook.result.current.handleEditCommit('notes', ' '));
    expect(deleteTask).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(4);
  });

  it('asks before deleting a parent and deletes plain tasks at once', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const { hook } = setup();
    act(() => hook.result.current.handleDelete('plan'));
    expect(confirm).toHaveBeenCalledWith('Delete "plan" and its 1 subtasks?');
    expect(deleteTask).not.toHaveBeenCalled();
    act(() => hook.result.current.handleDelete('plain'));
    expect(deleteTask).toHaveBeenCalledWith('plain');
  });
});
