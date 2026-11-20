import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmTaskDelete, descendantCount, holdsWork } from '../deleteGuard';

const tasks = [
  { id: 'p', title: 'Plan' },
  { id: 'c1', title: 'Child', parentTaskId: 'p' },
  { id: 'g1', title: 'Grandchild', parentTaskId: 'c1' },
  { id: 'n', title: 'Notes only', description: 'Goal: ship' },
  { id: 'x', title: 'Plain' },
];
const t = (key: string, params?: Record<string, string | number>) => `${key}:${JSON.stringify(params)}`;

afterEach(() => vi.unstubAllGlobals());

describe('deleteGuard', () => {
  it('counts every loaded descendant', () => {
    expect(descendantCount('p', tasks)).toBe(2);
    expect(descendantCount('x', tasks)).toBe(0);
  });

  it('treats subtasks or notes as work that must not vanish silently', () => {
    expect(holdsWork(tasks[0], tasks)).toBe(true);
    expect(holdsWork(tasks[3], tasks)).toBe(true);
    expect(holdsWork(tasks[4], tasks)).toBe(false);
  });

  it('deletes plain tasks without asking and asks with the cascade count otherwise', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    expect(confirmTaskDelete(tasks[4], tasks, t)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(confirmTaskDelete(tasks[0], tasks, t)).toBe(false);
    expect(confirm).toHaveBeenCalledWith('task.deleteCascade:{"title":"Plan","count":2}');
    confirm.mockReturnValue(true);
    expect(confirmTaskDelete(tasks[3], tasks, t)).toBe(true);
    expect(confirm).toHaveBeenLastCalledWith('task.deleteWithNotes:{"title":"Notes only"}');
  });
});
