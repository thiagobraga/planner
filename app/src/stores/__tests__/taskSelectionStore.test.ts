import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskSelectionStore } from '../taskSelectionStore';

describe('useTaskSelectionStore', () => {
  beforeEach(() => {
    useTaskSelectionStore.getState().clearSelection();
  });

  it('selects a single task when isMulti is false and no tasks are selected', () => {
    const store = useTaskSelectionStore.getState();
    store.selectTask('task-1', false);
    expect(useTaskSelectionStore.getState().isSelected('task-1')).toBe(true);
    expect(useTaskSelectionStore.getState().selectedTaskIds.size).toBe(1);
  });

  it('replaces selection with a single task when isMulti is false and single task was selected', () => {
    const store = useTaskSelectionStore.getState();
    store.selectTask('task-1', false);
    store.selectTask('task-2', false); // Since only task-1 was selected (size <= 1), in single mode it replaces
    expect(useTaskSelectionStore.getState().isSelected('task-1')).toBe(false);
    expect(useTaskSelectionStore.getState().isSelected('task-2')).toBe(true);
  });

  it('toggles selection when isMulti is true', () => {
    const store = useTaskSelectionStore.getState();
    store.selectTask('task-1', false);
    store.selectTask('task-2', true); // Ctrl + click
    expect(useTaskSelectionStore.getState().isSelected('task-1')).toBe(true);
    expect(useTaskSelectionStore.getState().isSelected('task-2')).toBe(true);

    store.selectTask('task-1', true); // Toggle task-1 off
    expect(useTaskSelectionStore.getState().isSelected('task-1')).toBe(false);
    expect(useTaskSelectionStore.getState().isSelected('task-2')).toBe(true);
  });

  it('clears selection', () => {
    const store = useTaskSelectionStore.getState();
    store.selectTask('task-1', true);
    store.selectTask('task-2', true);
    store.clearSelection();
    expect(useTaskSelectionStore.getState().selectedTaskIds.size).toBe(0);
  });
});
