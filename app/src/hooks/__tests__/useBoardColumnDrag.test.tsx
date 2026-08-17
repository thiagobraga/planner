import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  ApiError,
  type BoardGroupBy,
  apiDeleteSection,
  apiDeleteStatus,
  apiUpdateSection,
  apiUpdateStatus,
} from '../../api/client';
import { useBoardColumnDrag, type UseBoardColumnDragResult } from '../useBoardColumnDrag';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiUpdateStatus: vi.fn(),
  apiUpdateSection: vi.fn(),
  apiDeleteStatus: vi.fn(),
  apiDeleteSection: vi.fn(),
}));

const mockUpdateStatus = vi.mocked(apiUpdateStatus);
const mockUpdateSection = vi.mocked(apiUpdateSection);
const mockDeleteStatus = vi.mocked(apiDeleteStatus);
const mockDeleteSection = vi.mocked(apiDeleteSection);

let registered: ((event: DragEndEvent) => void) | null = null;

vi.mock('../../contexts/usePlannerDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/usePlannerDrag')>();
  return {
    ...actual,
    usePlannerDragHandlers: (_kind: string, handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
      registered = handlers.onDragEnd ?? registered;
    },
  };
});

const COLLECTION = 'collection-1';

function column(
  id: string,
  value: string | number | null,
  title: string,
  tasks = 0,
): BoardColumnModel {
  return {
    id,
    value,
    title,
    tasks: Array.from({ length: tasks }, (_, index) => ({
      id: `${id}-task-${index}`,
      title: `Task ${index}`,
      priority: 4,
      collectionId: COLLECTION,
      isCompleted: false,
      orderValue: index * 1000,
      depth: 0,
      type: 'task',
    })),
  };
}

function drag(kind: BoardGroupBy, activeId: string, overId: string) {
  return {
    active: {
      id: activeId,
      data: { current: { kind: 'board-column', columnId: activeId, collectionId: COLLECTION, groupBy: kind } },
    },
    over: {
      id: overId,
      data: { current: { kind: 'board-column-header', columnId: overId, collectionId: COLLECTION, groupBy: kind } },
    },
  } as unknown as DragEndEvent;
}

function renderHook(initialColumns: BoardColumnModel[], groupBy: BoardGroupBy) {
  let result: UseBoardColumnDragResult | null = null;
  let currentColumns = initialColumns;

  function Harness() {
    const [columns, setColumns] = useState(initialColumns);
    currentColumns = columns;
    result = useBoardColumnDrag({
      collectionId: COLLECTION,
      groupBy,
      columns,
      setColumns,
    });
    return null;
  }

  render(<Harness />);
  return {
    get result() {
      return result;
    },
    get columns() {
      return currentColumns;
    },
  };
}

async function drop(event: DragEndEvent) {
  await act(async () => {
    registered?.(event);
  });
}

beforeEach(() => {
  registered = null;
  mockUpdateStatus.mockReset();
  mockUpdateSection.mockReset();
  mockDeleteStatus.mockReset();
  mockDeleteSection.mockReset();
  mockUpdateStatus.mockResolvedValue({} as never);
  mockUpdateSection.mockResolvedValue({} as never);
  mockDeleteStatus.mockResolvedValue({ success: true });
  mockDeleteSection.mockResolvedValue({ success: true });
});

describe('useBoardColumnDrag', () => {
  it('reorders status columns and writes the new target index', async () => {
    const harness = renderHook(
      [
        column('status:backlog', 'backlog', 'Backlog'),
        column('status:doing', 'doing', 'Doing'),
        column('status:done', 'done', 'Done'),
      ],
      'status',
    );

    await drop(drag('status', 'status:backlog', 'status:done'));

    expect(mockUpdateStatus).toHaveBeenCalledWith('backlog', { position: 2 });
    expect(harness.columns.map((entry) => entry.id)).toEqual([
      'status:doing',
      'status:done',
      'status:backlog',
    ]);
  });

  it('reorders section columns while leaving the no-section bucket pinned', async () => {
    const harness = renderHook(
      [
        column('section:none', null, 'No section'),
        column('section:s1', 's1', 'Alpha'),
        column('section:s2', 's2', 'Beta'),
        column('section:s3', 's3', 'Gamma'),
      ],
      'section',
    );

    await drop(drag('section', 'section:s1', 'section:s3'));

    expect(mockUpdateSection).toHaveBeenCalledWith('s1', { position: 2 });
    expect(harness.columns.map((entry) => entry.id)).toEqual([
      'section:none',
      'section:s2',
      'section:s3',
      'section:s1',
    ]);
  });

  it('opens a status delete dialog with reassign choices and removes the column on success', async () => {
    const harness = renderHook(
      [
        column('status:backlog', 'backlog', 'Backlog', 2),
        column('status:doing', 'doing', 'Doing', 1),
        column('status:done', 'done', 'Done', 0),
      ],
      'status',
    );

    act(() => harness.result?.openDeleteColumn('status:doing'));

    expect(harness.result?.deleteModal?.isOpen).toBe(true);
    expect(harness.result?.deleteModal?.reassignOptions.map((option) => option.value)).toEqual([
      'backlog',
      'done',
    ]);

    act(() => harness.result?.deleteModal?.onChangeReassignToId('done'));
    await act(async () => {
      await harness.result?.deleteModal?.onDelete();
    });

    expect(mockDeleteStatus).toHaveBeenCalledWith('doing', 'done');
    expect(harness.columns.map((entry) => entry.id)).toEqual([
      'status:backlog',
      'status:done',
    ]);
    expect(harness.result?.deleteModal).toBeNull();
  });

  it('surfaces the last-column conflict message from the API and keeps the dialog open', async () => {
    const harness = renderHook([column('status:backlog', 'backlog', 'Backlog', 2)], 'status');
    mockDeleteStatus.mockRejectedValueOnce(
      new ApiError({
        message: 'Cannot delete the last status in a collection',
        code: 'CONFLICT',
        status: 409,
      }),
    );

    act(() => harness.result?.openDeleteColumn('status:backlog'));

    await act(async () => {
      await harness.result?.deleteModal?.onDelete();
    });

    await waitFor(() =>
      expect(harness.result?.deleteModal?.errorMessage).toBe(
        'Cannot delete the last status in a collection',
      ),
    );
    expect(harness.columns.map((entry) => entry.id)).toEqual(['status:backlog']);
  });

  it('deletes a section column without a reassignment target', async () => {
    const harness = renderHook(
      [column('section:none', null, 'No section'), column('section:s1', 's1', 'Alpha', 3)],
      'section',
    );

    act(() => harness.result?.openDeleteColumn('section:s1'));
    await act(async () => {
      await harness.result?.deleteModal?.onDelete();
    });

    expect(mockDeleteSection).toHaveBeenCalledWith('s1');
    expect(harness.columns.map((entry) => entry.id)).toEqual(['section:none']);
  });
});
