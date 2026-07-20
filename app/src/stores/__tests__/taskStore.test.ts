import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../taskStore';

interface Task {
  id: string;
  title: string;
  priority: number;
  collectionId: string;
  isCompleted: boolean;
  orderValue: number;
}

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Test task',
    priority: 1,
    collectionId: 'col-1',
    isCompleted: false,
    orderValue: 0,
    ...overrides,
  };
}

describe('useTaskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [] });
  });

  it('setTasks replaces state', () => {
    const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })];
    useTaskStore.getState().setTasks(tasks);
    expect(useTaskStore.getState().tasks).toEqual(tasks);
  });

  it('addTask appends to array', () => {
    const t1 = makeTask({ id: '1' });
    const t2 = makeTask({ id: '2' });
    useTaskStore.getState().addTask(t1);
    useTaskStore.getState().addTask(t2);
    expect(useTaskStore.getState().tasks).toEqual([t1, t2]);
  });

  it('updateTask patches by id', () => {
    useTaskStore.getState().addTask(makeTask({ id: '1', title: 'Original' }));
    useTaskStore.getState().updateTask('1', { title: 'Updated', isCompleted: true });
    const task = useTaskStore.getState().tasks[0];
    expect(task.title).toBe('Updated');
    expect(task.isCompleted).toBe(true);
  });

  it('updateTask does nothing for non-existent id', () => {
    useTaskStore.getState().addTask(makeTask({ id: '1', title: 'Original' }));
    useTaskStore.getState().updateTask('nonexistent', { title: 'Updated' });
    expect(useTaskStore.getState().tasks[0].title).toBe('Original');
  });

  it('removeTask removes by id', () => {
    const t1 = makeTask({ id: '1' });
    const t2 = makeTask({ id: '2' });
    useTaskStore.getState().setTasks([t1, t2]);
    useTaskStore.getState().removeTask('1');
    expect(useTaskStore.getState().tasks).toEqual([t2]);
  });

  it('removeTask does nothing for non-existent id', () => {
    useTaskStore.getState().setTasks([makeTask({ id: '1' })]);
    useTaskStore.getState().removeTask('nonexistent');
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });
});
