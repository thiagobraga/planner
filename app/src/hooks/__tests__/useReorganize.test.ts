import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiReorganizeTasks } from '../../api/client';
import type { ApiTask } from '../../types/api';
import type { Section } from '../../types/hooks';
import { useReorganize } from '../useReorganize';

vi.mock('../../api/client', () => ({ apiReorganizeTasks: vi.fn() }));

const today = '2026-08-13';
const tomorrow = '2026-08-14';
const overdue = '2026-08-12';

function task(id: string, overrides: Partial<ApiTask> = {}): ApiTask {
  return {
    id,
    title: id,
    priority: 0,
    collectionId: 'collection-1',
    dueDate: today,
    isCompleted: false,
    orderValue: 0,
    depth: 0,
    type: 'task',
    ...overrides,
  };
}

function tasks(count: number, dueDate = today): ApiTask[] {
  return Array.from({ length: count }, (_, i) => task(`t${i}`, { dueDate }));
}

function section(date: string, items: ApiTask[], label = date): Section {
  return { date, label, tasks: items };
}

beforeEach(() => {
  vi.mocked(apiReorganizeTasks).mockReset();
  vi.mocked(apiReorganizeTasks).mockResolvedValue({ updated: 0 });
});

afterEach(cleanup);

describe('useReorganize', () => {
  it.each([0, 7, 8, 9])('checks eligibility with %i uncompleted root tasks', (count) => {
    const { result } = renderHook(() => useReorganize(today, [section(today, tasks(count))]));
    expect(result.current.showButton).toBe(count >= 8);
    expect(result.current.state).toBe('idle');
    expect(result.current.previewSections).toBeNull();
  });

  it('updates eligibility as sections arrive and includes overdue tasks', () => {
    const { result, rerender } = renderHook(
      ({ sections }: { sections: Section[] | null }) => useReorganize(today, sections),
      { initialProps: { sections: null } as { sections: Section[] | null } },
    );
    expect(result.current.showButton).toBe(false);
    act(() => result.current.startPreview());
    expect(result.current.state).toBe('idle');

    rerender({ sections: [section(overdue, [task('overdue', { dueDate: overdue })]), section(today, tasks(7))] });
    expect(result.current.showButton).toBe(true);
    rerender({ sections: [section(today, tasks(7))] });
    expect(result.current.showButton).toBe(false);
  });

  it.each([
    ['completed', { isCompleted: true }],
    ['subtask', { parentTaskId: 'parent' }],
    ['note', { type: 'note' }],
    ['event', { type: 'event' }],
  ] satisfies [string, Partial<ApiTask>][])('excludes a %s from eligibility and redistribution', (_, overrides) => {
    const excluded = task('excluded', overrides);
    const { result } = renderHook(() =>
      useReorganize(today, [section(today, [...tasks(7), excluded])]),
    );
    expect(result.current.showButton).toBe(false);
    act(() => result.current.startPreview());
    expect(result.current.previewSections?.[0].tasks).toContainEqual(excluded);
    expect(result.current.previewSections?.[1].tasks.map((item: ApiTask) => item.id)).toEqual(['t5', 't6']);
  });

  it('does not count or reschedule future tasks', () => {
    const future = task('future', { dueDate: tomorrow });
    const { result } = renderHook(() =>
      useReorganize(today, [section(today, tasks(7)), section(tomorrow, [future])]),
    );
    expect(result.current.showButton).toBe(false);
    act(() => result.current.startPreview());
    expect(result.current.previewSections?.[1].tasks).toEqual([
      future,
      { ...task('t5', { dueDate: tomorrow }), moved: true },
      { ...task('t6', { dueDate: tomorrow }), moved: true },
    ]);
  });

  it('distributes ≤5 tasks per day without mutating the source', () => {
    // Simulate: 10 tasks → 5 on day 1, 5 on day 2
    const sections = [section(overdue, tasks(10, overdue))];
    const original = structuredClone(sections);
    const onPreview = vi.fn();
    const { result } = renderHook(() => useReorganize(today, sections, onPreview));

    // Simulate distribution
    act(() => result.current.startPreview());

    expect(result.current.state).toBe('preview');
    expect(result.current.previewSections).toEqual([
      { date: today, label: 'Today', tasks: tasks(5).map((item) => ({ ...item, moved: true })) },
      {
        date: tomorrow,
        label: 'Tomorrow',
        tasks: tasks(10, tomorrow).slice(5).map((item) => ({ ...item, moved: true })),
      },
    ]);
    expect(sections).toEqual(original);
    expect(onPreview).toHaveBeenCalledOnce();
    expect(apiReorganizeTasks).not.toHaveBeenCalled();
  });

  it('keeps display order across overdue and today and uses custom labels for new dates', () => {
    const formatLabel = vi.fn((date: string) => `Label ${date}`);
    const sections = [
      section(overdue, [task('overdue', { dueDate: overdue })]),
      section(today, tasks(10), 'Existing today'),
    ];
    const { result } = renderHook(() => useReorganize(today, sections, undefined, undefined, formatLabel));
    act(() => result.current.startPreview());
    expect(result.current.previewSections?.map((item) => [item.date, item.label, item.tasks.map((t: ApiTask) => t.id)]))
      .toEqual([
        [today, 'Existing today', ['overdue', 't0', 't1', 't2', 't3']],
        [tomorrow, `Label ${tomorrow}`, ['t4', 't5', 't6', 't7', 't8']],
        ['2026-08-15', 'Label 2026-08-15', ['t9']],
      ]);
  });

  it('cancels preview without persisting and can start again', () => {
    const onRevert = vi.fn();
    const { result } = renderHook(() => useReorganize(today, [section(today, tasks(8))], undefined, onRevert));
    act(() => result.current.cancelReorganize());
    expect(onRevert).not.toHaveBeenCalled();
    act(() => result.current.startPreview());
    act(() => result.current.cancelReorganize());
    expect(result.current.state).toBe('idle');
    expect(result.current.previewSections).toBeNull();
    expect(onRevert).toHaveBeenCalledOnce();
    expect(apiReorganizeTasks).not.toHaveBeenCalled();
    act(() => result.current.startPreview());
    expect(result.current.state).toBe('preview');
  });

  it('persists only changed dates and waits for confirmation before clearing the preview', async () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() =>
      useReorganize(today, [section(today, tasks(8))], undefined, undefined, undefined, onConfirmed),
    );
    await act(async () => { await result.current.confirmReorganize(); });
    expect(apiReorganizeTasks).not.toHaveBeenCalled();
    act(() => result.current.startPreview());
    const preview = result.current.previewSections;
    let resolve!: (value: Awaited<ReturnType<typeof apiReorganizeTasks>>) => void;
    const promise = new Promise<Awaited<ReturnType<typeof apiReorganizeTasks>>>((done) => {
      resolve = done;
    });
    vi.mocked(apiReorganizeTasks).mockReturnValueOnce(promise);
    let confirmation!: Promise<void>;
    act(() => { confirmation = result.current.confirmReorganize(); });
    expect(result.current.state).toBe('persisting');
    expect(result.current.previewSections).toBe(preview);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(apiReorganizeTasks).toHaveBeenCalledExactlyOnceWith([
      { taskId: 't5', dueDate: tomorrow },
      { taskId: 't6', dueDate: tomorrow },
      { taskId: 't7', dueDate: tomorrow },
    ]);
    await act(async () => {
      resolve({ updated: 3 });
      await confirmation;
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.previewSections).toBeNull();
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it('retains the preview after a persistence error and allows retry', async () => {
    const error = new Error('Offline');
    vi.mocked(apiReorganizeTasks).mockRejectedValueOnce(error);
    const onConfirmed = vi.fn();
    const { result } = renderHook(() =>
      useReorganize(today, [section(today, tasks(8))], undefined, undefined, undefined, onConfirmed),
    );
    act(() => result.current.startPreview());
    const preview = result.current.previewSections;
    await act(async () => {
      await expect(result.current.confirmReorganize()).rejects.toBe(error);
    });
    expect(result.current.state).toBe('preview');
    expect(result.current.previewSections).toBe(preview);
    expect(onConfirmed).not.toHaveBeenCalled();
    await act(async () => { await result.current.confirmReorganize(); });
    expect(apiReorganizeTasks).toHaveBeenCalledTimes(2);
    expect(apiReorganizeTasks).toHaveBeenNthCalledWith(2, vi.mocked(apiReorganizeTasks).mock.calls[0][0]);
    expect(result.current.state).toBe('idle');
    expect(result.current.previewSections).toBeNull();
    expect(onConfirmed).toHaveBeenCalledOnce();
  });
});
