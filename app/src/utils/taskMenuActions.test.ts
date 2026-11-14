import { describe, expect, it, vi } from 'vitest';
import { buildTaskMenuActions, resolveStageActions } from './taskMenuActions';
import type { ApiStatus } from '../types/api';
import type { Task } from '../components/TaskItem';

const status = (id: string, orderValue: number, changes: Partial<ApiStatus> = {}): ApiStatus => ({
  id, collectionId: 'collection', name: id, color: '#44443d', orderValue,
  nextStatusMode: 'default', nextStatusId: null, acceptStatusId: null, rejectStatusId: null,
  createdAt: '', updatedAt: '', ...changes,
});
const task = { id: 'task', title: 'Task', type: 'task', collectionId: 'collection', statusId: 'a', isCompleted: false } as Task;
const translate = (key: string, values?: Record<string, string | number>) => `${key}${values?.stage ?? ''}`;

describe('task menu stage actions', () => {
  it('resolves display order, custom destinations and disabled next', () => {
    const statuses = [status('b', 2), status('a', 1, { acceptStatusId: 'c', rejectStatusId: 'b' }), status('c', 3)];
    expect(resolveStageActions(task, statuses, 'c')).toEqual({ next: statuses[0], accept: statuses[2], reject: statuses[0] });
    expect(resolveStageActions(task, [statuses[0], status('a', 1, { nextStatusMode: 'custom', nextStatusId: 'c' }), statuses[2]], 'c').next?.id).toBe('c');
    expect(resolveStageActions(task, [statuses[0], status('a', 1, { nextStatusMode: 'disabled' }), statuses[2]], 'c').next).toBeNull();
  });

  it('does not offer outgoing actions on the completion column or for notes', () => {
    const statuses = [status('a', 1), status('b', 2)];
    expect(resolveStageActions({ ...task, statusId: 'b' }, statuses, 'b')).toEqual({ next: null, accept: null, reject: null });
    expect(buildTaskMenuActions({ task: { ...task, type: 'note' }, statuses, completionStatusId: 'b', t: translate, onToggle: vi.fn(), onMove: vi.fn() })).toEqual([]);
  });

  it('uses the board default for tasks without an assigned status', () => {
    const statuses = [status('a', 1), status('b', 2)];
    expect(resolveStageActions({ ...task, statusId: null }, statuses, 'b').next?.id).toBe('b');
  });

  it('keeps completion and stage actions separate', () => {
    const onToggle = vi.fn();
    const onMove = vi.fn();
    const items = buildTaskMenuActions({ task, statuses: [status('a', 1), status('b', 2)], completionStatusId: 'b', t: translate, onToggle, onMove });
    expect(items[0]?.label).toBe('contextMenu.complete');
    items[0]?.onClick?.();
    expect(onToggle).toHaveBeenCalledOnce();
    expect(items[1]?.label).toBe('contextMenu.moveToStageb');
    items[1]?.onClick?.();
    expect(onMove).toHaveBeenCalledWith('b');
  });
});
