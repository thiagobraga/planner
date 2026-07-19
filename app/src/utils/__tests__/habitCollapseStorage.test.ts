import { describe, it, expect, vi } from 'vitest';
import {
  loadCollapsedHabitIds,
  pruneCollapsedHabitIds,
  saveCollapsedHabitIds,
} from '../habitCollapseStorage';

function storageMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  } as unknown as Storage;
}

describe('habitCollapseStorage', () => {
  it('round-trips collapsed ids through storage', () => {
    const storage = storageMock();
    saveCollapsedHabitIds(new Set(['water', 'meds']), storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      'planner.habits.collapsed.v1',
      JSON.stringify(['water', 'meds']),
    );
    expect(loadCollapsedHabitIds(storage)).toEqual(new Set(['water', 'meds']));
  });

  it('ignores malformed payloads', () => {
    const storage = storageMock({ 'planner.habits.collapsed.v1': '{"not":"an array"}' });
    expect(loadCollapsedHabitIds(storage)).toEqual(new Set());
  });

  it('drops ids that no longer exist', () => {
    expect(
      pruneCollapsedHabitIds(new Set(['water', 'old-id']), new Set(['water', 'meds'])),
    ).toEqual(new Set(['water']));
  });
});
