import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HabitsPage } from '../HabitsPage';
import {
  fetchHabits,
  fetchHabitGroups,
  fetchPreferences,
} from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchHabits: vi.fn(),
  fetchHabitGroups: vi.fn(),
  fetchPreferences: vi.fn(),
  apiCreateHabit: vi.fn(),
  apiUpdateHabit: vi.fn(),
  apiDeleteHabit: vi.fn(),
  apiToggleHabitCompletion: vi.fn(),
  apiCreateHabitGroup: vi.fn(),
  apiUpdateHabitGroup: vi.fn(),
  apiDeleteHabitGroup: vi.fn(),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: vi.fn(),
}));

vi.mock('../../hooks/useHabitDrag', () => ({
  useHabitDrag: () => ({ activeDragId: null }),
}));

vi.mock('../../utils/phrases', () => ({
  getPhrase: () => 'Small reps build large lives.',
}));

vi.mock('../../components/habits/HabitTimeline', () => ({
  HabitTimeline: () => <div data-testid="habit-timeline" />,
}));

vi.mock('../../components/habits/HabitCalendar', () => ({
  HabitCalendar: () => <div data-testid="habit-calendar" />,
}));

const mockFetchHabits = vi.mocked(fetchHabits);
const mockFetchHabitGroups = vi.mocked(fetchHabitGroups);
const mockFetchPreferences = vi.mocked(fetchPreferences);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HabitsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetchHabits.mockResolvedValue([]);
  mockFetchHabitGroups.mockResolvedValue([]);
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
    hideOldNotes: false,
  });
});

describe('HabitsPage', () => {
  it('renders header with "Habits" title and phrase', () => {
    renderPage();

    const header = screen.getByText('Habits').closest('header');

    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByText('Small reps build large lives.'));
    expect(header).not.toContainElement(screen.getByRole('button', { name: 'Today' }));
    expect(header).not.toContainElement(screen.getByLabelText('Timeline view'));
    expect(header).not.toContainElement(screen.getByLabelText('Calendar view'));
    expect(screen.getByRole('button', { name: 'Today' }).closest('.page-header-toolbar')).toHaveClass('sticky');
  });

  it('renders view toggle buttons (Timeline/Calendar)', () => {
    renderPage();

    expect(screen.getByLabelText('Timeline view')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar view')).toBeInTheDocument();
  });

  it('Timeline view is default', () => {
    renderPage();

    expect(screen.getByTestId('habit-timeline')).toBeInTheDocument();
    expect(screen.queryByTestId('habit-calendar')).not.toBeInTheDocument();
  });

  it('Today button is present', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('calls fetchHabits on mount', () => {
    renderPage();

    expect(mockFetchHabits).toHaveBeenCalled();
  });
});
