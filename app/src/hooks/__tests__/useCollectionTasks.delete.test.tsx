import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import type { Task } from '../../types/task';
import { useCollectionTasks } from '../useCollectionTasks';

const deleteTask = vi.fn(() => Promise.resolve());
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiDeleteTask: (id: string) => deleteTask(id),
}));

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, isCompleted: false, ...extra } as Task);

function setup(tasks: Task[]) {
  let current = tasks;
  const setTasks = vi.fn((next: Task[] | ((prev: Task[]) => Task[])) => {
    current = typeof next === 'function' ? next(current) : next;
  });
  const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;
  const hook = renderHook(() => useCollectionTasks({
    id: 'col', locale: 'en', tasks, setTasks, hideCompletedTasks: false, includeCompleted: false, invalidate: () => Promise.resolve(),
  }), { wrapper });
  return { hook, rows: () => current };
}

beforeEach(() => deleteTask.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe('useCollectionTasks deletion guard', () => {
  const tasks = [task('plan'), task('child', { parentTaskId: 'plan' }), task('notes', { description: 'Goal' }), task('plain')];

  it('drops an empty rename on a task with subtasks or notes instead of deleting it', () => {
    const { hook, rows } = setup(tasks);
    act(() => hook.result.current.handleEditCommit('plan', '   '));
    act(() => hook.result.current.handleEditCommit('notes', ''));
    expect(deleteTask).not.toHaveBeenCalled();
    expect(rows().map((row) => row.id)).toEqual(['plan', 'child', 'notes', 'plain']);
  });

  it('still deletes a plain task cleared by rename', () => {
    const { hook } = setup(tasks);
    act(() => hook.result.current.handleEditCommit('plain', ''));
    expect(deleteTask).toHaveBeenCalledWith('plain');
  });

  it('asks before deleting a parent and keeps it when declined', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const { hook } = setup(tasks);
    act(() => hook.result.current.handleDelete('plan'));
    expect(confirm).toHaveBeenCalledWith('Delete "plan" and its 1 subtasks?');
    expect(deleteTask).not.toHaveBeenCalled();
  });
});
