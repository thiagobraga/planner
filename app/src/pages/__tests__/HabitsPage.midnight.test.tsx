import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HabitsPage } from '../HabitsPage';
import { fetchHabits, fetchPreferences } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchHabits: vi.fn(),
  fetchPreferences: vi.fn(),
}));

vi.mock('../../hooks/useSync', () => ({ useSync: vi.fn() }));
vi.mock('../../hooks/useHabitDrag', () => ({ useHabitDrag: () => ({ activeDragId: null }) }));

let midnightCallback: (() => void) | null = null;
vi.mock('../../hooks/useMidnightTimer', () => ({
  useMidnightTimer: vi.fn((callback: () => void) => {
    midnightCallback = callback;
  }),
}));

vi.mock('../../components/habits/HabitTimeline', () => ({
  HabitTimeline: ({ today }: { today: Date }) => (
    <div data-testid="habit-timeline" data-today={today.toDateString()} />
  ),
}));

vi.mock('../../components/habits/HabitCalendar', () => ({
  HabitCalendar: () => <div data-testid="habit-calendar" />,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HabitsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HabitsPage midnight rollover', () => {
  beforeEach(() => {
    midnightCallback = null;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    vi.mocked(fetchHabits).mockResolvedValue({ habits: [], groups: [] });
    vi.mocked(fetchPreferences).mockResolvedValue({
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
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves today to the next day when midnight passes', async () => {
    renderPage();
    await waitFor(() => expect(midnightCallback).not.toBeNull());
    await waitFor(() => expect(fetchPreferences).toHaveBeenCalled());
    expect(screen.getByTestId('habit-timeline')).toHaveAttribute('data-today', 'Fri Oct 16 2026');

    vi.setSystemTime(new Date('2026-10-17T00:00:05Z'));
    act(() => midnightCallback?.());

    await waitFor(() =>
      expect(screen.getByTestId('habit-timeline')).toHaveAttribute('data-today', 'Sat Oct 17 2026'),
    );
  });
});
