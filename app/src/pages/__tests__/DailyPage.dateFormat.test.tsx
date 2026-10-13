import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { DailyRoute } from '../DailyRoutes';
import { dailyView } from '../../test/dailyFixtures';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { fetchCollections, fetchPreferences, fetchDaily, apiMoveTask } from '../../api/client';

/**
 * The user's date format has to survive a drag.
 *
 * `buildSections` and `dayLabel` both default their `dateFormat` parameter to
 * `'MMM DD ddd'`, so any call site that forgets to pass the preference silently
 * renders the *default* format rather than failing. `setAllTasks` - which
 * `useTaskDrag` calls on every optimistic update - omitted it, so the section
 * header flipped from the user's `DD/MM ddd` to the default `MMM DD ddd` the
 * instant a drag moved a task, and stayed wrong until the page remounted. (The
 * report was in pt-BR - "06/08 QUI" becoming "AGO 06 QUI" - but the format
 * switch is locale-independent, and these render under the default `en`.)
 *
 * This drives a real drag through the real `PlannerDragProvider` rather than
 * calling `buildSections` directly: the bug was in the wiring at one call site,
 * not in the formatter, and a unit test on the formatter passed throughout.
 */

type DragHandler = (event: unknown) => void;

interface DndContextProps {
  children: React.ReactNode;
  onDragStart?: DragHandler;
  onDragMove?: DragHandler;
  onDragOver?: DragHandler;
  onDragEnd?: DragHandler;
  onDragCancel?: DragHandler;
}

const { dndHandlers } = vi.hoisted(() => ({
  dndHandlers: {} as Record<string, DragHandler | undefined>,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragMove,
      onDragOver,
      onDragEnd,
      onDragCancel,
    }: DndContextProps) => {
      Object.assign(dndHandlers, { onDragStart, onDragMove, onDragOver, onDragEnd, onDragCancel });
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('../../utils/socket', () => ({
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), connected: true }),
}));

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDaily: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiMoveTask: vi.fn(),
}));

const mockFetchDaily = vi.mocked(fetchDaily);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiMoveTask = vi.mocked(apiMoveTask);

// Sunday to Thursday: the list keeps the earlier days of the week visible.
const WEEK_BEFORE_TODAY_AND_TODAY = ['02/08 SUN', '03/08 MON', '04/08 TUE', '05/08 WED', '06/08 THU · Today'];

// Two dates, so there is a real cross-day drag to perform.
const TODAY = '2026-08-06';
const YESTERDAY = '2026-08-05';

const apiTask = (id: string, title: string, dueDate: string, orderValue: number) => ({
  id,
  title,
  priority: 4,
  collectionId: 'collection-1',
  isCompleted: false,
  orderValue,
  type: 'task' as const,
  dueDate,
  createdAt: `${dueDate}T12:00:00Z`,
});

const dragData = (taskId: string, dueDate: string) => ({
  kind: 'task',
  taskId,
  parentTaskId: null,
  collectionId: 'collection-1',
  dueDate,
  depth: 0,
  containerId: `day:${dueDate}`,
  subtreeIds: [taskId],
});

/**
 * The day headers currently rendered, in order.
 *
 * Read from the day sections' own header element rather than via `getByText`:
 * the label is the whole point of these assertions, so comparing the full list
 * says exactly what changed when one fails, instead of "unable to find text".
 */
const dayHeaders = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-day-date]'))
    .filter((section) => (section.getAttribute('data-day-date') ?? '') <= TODAY || section.getAttribute('data-day-date') === 'migrate')
    .map((section) =>
    section.firstElementChild?.textContent?.trim(),
  );

function renderPage(slug = 'list') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/daily/${slug}`]}>
        <PlannerDragProvider>
          <Routes><Route path="/daily/:view" element={<DailyRoute />} /></Routes>
        </PlannerDragProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // A fixed clock so `todayKey` is deterministic, but *real* timers: React
  // Query's retry/resolution scheduling runs on timers, and faking them stalls
  // the preferences query behind the tasks query.
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

  mockFetchDaily.mockReset();
  mockFetchCollections.mockReset();
  mockFetchPreferences.mockReset();
  mockApiMoveTask.mockReset();

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });

  mockFetchCollections.mockResolvedValue([]);
  mockFetchPreferences.mockResolvedValue({
    userId: 'user-1',
    timeZone: 'UTC',
    weekStart: 'sunday',
    theme: 'system',
    notificationsEnabled: true,
    font: 'lora',
    showDots: true,
    background: 'beige',
    smallCaps: false,
    hideCompletedTasks: false,
    showNotes: true,
    // The whole point: a non-default format.
    dateFormat: 'DD/MM ddd',
  } as Awaited<ReturnType<typeof fetchPreferences>>);

  mockFetchDaily.mockResolvedValue(dailyView({
    overdue: [apiTask('task-old', 'Yesterday task', YESTERDAY, 1000)],
    today: [apiTask('task-new', 'Today task', TODAY, 2000)],
  }));

  mockApiMoveTask.mockResolvedValue({ moved: [], reordered: [] } as Awaited<
    ReturnType<typeof apiMoveTask>
  >);
});

describe('DailyPage: the date format preference survives a drag', () => {
  it('keeps the user format in the section header after a drag rebuilds the sections', async () => {
    const { container } = renderPage();

    // Baseline: the preference is honoured on first render. If this ever fails
    // the test below proves nothing, because it could pass with the format
    // never having been right in the first place. Preferences and tasks are two
    // separate queries, so the sections are first built from whichever lands
    // first and rebuilt once the format is known - hence waitFor.
    await waitFor(() => expect(dayHeaders(container)).toEqual(WEEK_BEFORE_TODAY_AND_TODAY));

    // Drag yesterday's task onto today's - the exact gesture from the report.
    await act(async () => {
      dndHandlers.onDragStart?.({
        active: { id: 'task-old', data: { current: dragData('task-old', YESTERDAY) } },
      });
      dndHandlers.onDragEnd?.({
        active: { id: 'task-old', data: { current: dragData('task-old', YESTERDAY) } },
        over: { id: 'task-new', data: { current: dragData('task-new', TODAY) } },
      });
    });

    // `setAllTasks` has now rebuilt every section. Before the fix the today
    // header read "AUG 06 THU": the rebuild fell through to buildSections'
    // default format. Yesterday's section stays, now empty, like the rest of the week.
    expect(dayHeaders(container)).toEqual(WEEK_BEFORE_TODAY_AND_TODAY);
  });

  it('keeps the user format when a move fails and the page refetches', async () => {
    mockApiMoveTask.mockRejectedValue(new Error('nope'));

    const { container } = renderPage();
    await waitFor(() => expect(dayHeaders(container)).toEqual(WEEK_BEFORE_TODAY_AND_TODAY));

    await act(async () => {
      dndHandlers.onDragStart?.({
        active: { id: 'task-old', data: { current: dragData('task-old', YESTERDAY) } },
      });
      dndHandlers.onDragEnd?.({
        active: { id: 'task-old', data: { current: dragData('task-old', YESTERDAY) } },
        over: { id: 'task-new', data: { current: dragData('task-new', TODAY) } },
      });
    });

    // The `onError` path rebuilds sections from a fresh fetch - a third call
    // site with the same omission. The snapshot is restored, so both days are
    // back, and both have to keep the user's format.
    await waitFor(() => expect(dayHeaders(container)).toEqual(WEEK_BEFORE_TODAY_AND_TODAY));
  });

  it('fetches today tasks once, reformatting locally once preferences resolve', async () => {
    const { container } = renderPage();

    // Preferences resolve after the tasks fetch in this suite's default mock
    // ordering. The format still has to end up right (proving the reformat
    // happened)...
    await waitFor(() => expect(dayHeaders(container)).toEqual(WEEK_BEFORE_TODAY_AND_TODAY));

    // ...without a second network round trip. A duplicate `views/today` call
    // here previously delayed everything gated on the fetched task count (e.g.
    // the Organize button) by a full extra round trip.
    expect(mockFetchDaily).toHaveBeenCalledTimes(1);
  });
});
