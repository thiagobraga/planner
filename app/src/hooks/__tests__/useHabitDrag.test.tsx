import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useHabitDrag } from '../useHabitDrag';
import { apiMoveHabit, apiMoveHabitGroup, type ApiHabit, type ApiHabitGroup } from '../../api/client';
import type { DragEndEvent } from '@dnd-kit/core';
import type { HabitDragData, HabitGroupDragData, HabitSectionDropData } from '../../types/drag';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiMoveHabit: vi.fn(),
  apiMoveHabitGroup: vi.fn(),
}));

const moveHabit = vi.mocked(apiMoveHabit);
const moveGroup = vi.mocked(apiMoveHabitGroup);

function habit(overrides: Partial<ApiHabit> & { id: string }): ApiHabit {
  return {
    name: overrides.id,
    parentId: null,
    groupId: null,
    orderValue: 0,
    completions: [],
    ...overrides,
  };
}

interface HarnessProps {
  habits: ApiHabit[];
  groups?: ApiHabitGroup[];
  onHabits?: (next: ApiHabit[]) => void;
  onGroups?: (next: ApiHabitGroup[]) => void;
  onError?: () => void;
}

function Harness({ habits, groups = [], onHabits, onGroups, onError }: HarnessProps) {
  useHabitDrag({
    habits,
    groups,
    setHabits: (next) => onHabits?.(next),
    setGroups: (next) => onGroups?.(next),
    onError,
  });
  return null;
}

function drag(data: HabitDragData | HabitGroupDragData) {
  return { id: 'active', data: { current: data } };
}

function over(data: HabitDragData | HabitSectionDropData) {
  return { id: 'over', data: { current: data } };
}

/**
 * The provider keeps its handler registry private, so tests reach it the same
 * way dnd-kit does: by rendering the hook and calling the registered callback
 * captured at registration time.
 */
let registered: ((event: DragEndEvent) => void) | null = null;

vi.mock('../../contexts/PlannerDragContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/PlannerDragContext')>();
  return {
    ...actual,
    usePlannerDragHandlers: (kind: string, handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
      // Both kinds register the same handler object, so either call captures it.
      registered = handlers.onDragEnd ?? registered;
    },
  };
});

function drop(event: Partial<DragEndEvent>) {
  act(() => {
    registered?.(event as DragEndEvent);
  });
}

beforeEach(() => {
  registered = null;
  moveHabit.mockReset();
  moveGroup.mockReset();
  moveHabit.mockResolvedValue({ moved: [], reordered: [] });
  moveGroup.mockResolvedValue({ reordered: [] });
});

describe('useHabitDrag: habit moves', () => {
  const habits = [
    habit({ id: 'a', orderValue: 0 }),
    habit({ id: 'b', orderValue: 1000 }),
    habit({ id: 'c', orderValue: 2000 }),
  ];

  function mount(props: Partial<HarnessProps> = {}) {
    const emitted: ApiHabit[][] = [];
    render(
      <PlannerDragProvider>
        <Harness
          habits={habits}
          onHabits={(next) => emitted.push(next)}
          {...props}
        />
      </PlannerDragProvider>,
    );
    return emitted;
  }

  it('reorders a root habit and sends its new sibling position', () => {
    mount();

    drop({
      active: drag({ kind: 'habit', habitId: 'c', parentId: null, groupId: null, childIds: [] }),
      over: over({ kind: 'habit', habitId: 'a', parentId: null, groupId: null, childIds: [] }),
    } as unknown as DragEndEvent);

    expect(moveHabit).toHaveBeenCalledWith('c', {
      parentId: null,
      groupId: null,
      position: 0,
    });
  });

  it('files a habit into a group when dropped on that section', () => {
    render(
      <PlannerDragProvider>
        <Harness
          habits={habits}
          groups={[{ id: 'morning', name: 'Morning', orderValue: 0 }]}
        />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({ kind: 'habit', habitId: 'a', parentId: null, groupId: null, childIds: [] }),
      over: over({ kind: 'habit-section', groupId: 'morning' }),
    } as unknown as DragEndEvent);

    expect(moveHabit).toHaveBeenCalledWith('a', {
      parentId: null,
      groupId: 'morning',
      position: 0,
    });
  });

  it('moves a habit back out of a group into the ungrouped list', () => {
    render(
      <PlannerDragProvider>
        <Harness
          habits={[habit({ id: 'a' }), habit({ id: 'grouped', groupId: 'morning' })]}
          groups={[{ id: 'morning', name: 'Morning', orderValue: 0 }]}
        />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({
        kind: 'habit',
        habitId: 'grouped',
        parentId: null,
        groupId: 'morning',
        childIds: [],
      }),
      over: over({ kind: 'habit-section', groupId: null }),
    } as unknown as DragEndEvent);

    expect(moveHabit).toHaveBeenCalledWith('grouped', {
      parentId: null,
      groupId: null,
      position: 1,
    });
  });

  it('refuses to nest a habit that has sub-habits', () => {
    render(
      <PlannerDragProvider>
        <Harness
          habits={[habit({ id: 'target' }), habit({ id: 'parent' }), habit({ id: 'kid', parentId: 'parent' })]}
        />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({
        kind: 'habit',
        habitId: 'parent',
        parentId: null,
        groupId: null,
        childIds: ['kid'],
      }),
      over: over({ kind: 'habit', habitId: 'target', parentId: null, groupId: null, childIds: [] }),
    } as unknown as DragEndEvent);

    // It still moves - as a root. What it must never do is take a parent.
    expect(moveHabit).toHaveBeenCalledWith('parent', expect.objectContaining({ parentId: null }));
  });

  it('does nothing when the drag is released outside any target', () => {
    mount();

    drop({
      active: drag({ kind: 'habit', habitId: 'a', parentId: null, groupId: null, childIds: [] }),
      over: null,
    } as unknown as DragEndEvent);

    expect(moveHabit).not.toHaveBeenCalled();
  });

  it('restores the pre-drag list and reports failure when the move is rejected', async () => {
    moveHabit.mockRejectedValue(new Error('nope'));
    const onError = vi.fn();
    const emitted: ApiHabit[][] = [];

    render(
      <PlannerDragProvider>
        <Harness
          habits={habits}
          onHabits={(next) => emitted.push(next)}
          onError={onError}
        />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({ kind: 'habit', habitId: 'c', parentId: null, groupId: null, childIds: [] }),
      over: over({ kind: 'habit', habitId: 'a', parentId: null, groupId: null, childIds: [] }),
    } as unknown as DragEndEvent);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(emitted.at(-1)).toEqual(habits);
  });
});

describe('useHabitDrag: group moves', () => {
  const groups: ApiHabitGroup[] = [
    { id: 'g1', name: 'One', orderValue: 0 },
    { id: 'g2', name: 'Two', orderValue: 1000 },
    { id: 'g3', name: 'Three', orderValue: 2000 },
  ];

  it('reorders a group to the requested position', () => {
    render(
      <PlannerDragProvider>
        <Harness habits={[]} groups={groups} />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({ kind: 'habit-group', groupId: 'g3' }),
      over: over({ kind: 'habit-group', groupId: 'g1' } as unknown as HabitSectionDropData),
    } as unknown as DragEndEvent);

    expect(moveGroup).toHaveBeenCalledWith('g3', { position: 0 });
  });

  it('renumbers groups optimistically with gap-based order values', () => {
    const emitted: ApiHabitGroup[][] = [];
    render(
      <PlannerDragProvider>
        <Harness
          habits={[]}
          groups={groups}
          onGroups={(next) => emitted.push(next)}
        />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({ kind: 'habit-group', groupId: 'g3' }),
      over: over({ kind: 'habit-group', groupId: 'g1' } as unknown as HabitSectionDropData),
    } as unknown as DragEndEvent);

    expect(emitted[0]?.map((g) => g.id)).toEqual(['g3', 'g1', 'g2']);
    expect(emitted[0]?.map((g) => g.orderValue)).toEqual([0, 1000, 2000]);
  });

  it('ignores a group dropped on itself', () => {
    render(
      <PlannerDragProvider>
        <Harness habits={[]} groups={groups} />
      </PlannerDragProvider>,
    );

    drop({
      active: drag({ kind: 'habit-group', groupId: 'g2' }),
      over: over({ kind: 'habit-group', groupId: 'g2' } as unknown as HabitSectionDropData),
    } as unknown as DragEndEvent);

    expect(moveGroup).not.toHaveBeenCalled();
  });
});
