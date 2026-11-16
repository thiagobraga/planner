import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HabitsPage } from '../HabitsPage';
import {
  fetchHabits,
  fetchHabitGroups,
  fetchPreferences,
  apiUpdateHabitGroup,
  apiToggleHabitCompletion,
} from '../../api/client';
import type { HabitNode } from '../../utils/habitTree';

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

vi.mock('../../utils/habitGroupIcon', () => ({
  randomHabitGroupIcon: () => '☀️',
}));

vi.mock('../../components/habits/HabitTimeline', () => ({
  HabitTimeline: ({
    sections,
    onToggleGroupIcon,
    onToggleDay,
  }: {
    sections: {
      ungrouped: HabitNode[];
      groups: { group: { id: string; name: string } }[];
    };
    onToggleGroupIcon: (id: string) => void;
    onToggleDay: (node: HabitNode, iso: string) => void;
  }) => (
    <div data-testid="habit-timeline">
      {sections.ungrouped[0] && (
        <button type="button" onClick={() => onToggleDay(sections.ungrouped[0]!, '2026-07-26')}>
          Toggle first habit day
        </button>
      )}
      {sections.groups.map(({ group }) => (
        <button key={group.id} type="button" onClick={() => onToggleGroupIcon(group.id)}>
          Toggle icon for {group.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../components/habits/HabitCalendar', () => ({
  HabitCalendar: () => <div data-testid="habit-calendar" />,
}));

const mockFetchHabits = vi.mocked(fetchHabits);
const mockFetchHabitGroups = vi.mocked(fetchHabitGroups);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiUpdateHabitGroup = vi.mocked(apiUpdateHabitGroup);
const mockApiToggleHabitCompletion = vi.mocked(apiToggleHabitCompletion);

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
  vi.clearAllMocks();
  window.localStorage.removeItem('planner.habits.view.v1');
  mockFetchHabits.mockResolvedValue({ habits: [], groups: [] });
  mockFetchHabitGroups.mockResolvedValue([]);
  mockApiUpdateHabitGroup.mockReset();
  mockApiToggleHabitCompletion.mockReset();
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
  });
});

describe('HabitsPage', () => {
  it('renders header with "Habits" title and controls', () => {
    renderPage();

    const header = screen.getByText('Habits').closest('header');

    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByLabelText('Timeline view'));
    expect(header).toContainElement(screen.getByLabelText('Calendar view'));
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

  it('puts week navigation in the header toolbar for the timeline', async () => {
    renderPage();

    const header = screen.getByText('Habits').closest('header')!;
    expect(header).toContainElement(screen.getByRole('button', { name: 'Today' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Previous' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Next' }));
    await screen.findByTestId('habit-timeline');
  });

  it('drops week navigation in the calendar, which keeps its month strip', async () => {
    renderPage();

    fireEvent.click(screen.getByLabelText('Calendar view'));

    expect(await screen.findByTestId('habit-calendar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('moves the toolbar into the bar above the navbar on phones', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const slot = document.createElement('div');
    slot.id = 'page-toolbar-mobile-slot';
    document.body.appendChild(slot);

    try {
      renderPage();

      const header = screen.getByText('Habits').closest('header')!;
      expect(slot).toContainElement(await screen.findByLabelText('Timeline view'));
      expect(header).not.toContainElement(screen.getByLabelText('Timeline view'));
      expect(slot).toContainElement(screen.getByRole('button', { name: 'Previous' }));
    } finally {
      slot.remove();
      window.matchMedia = matchMedia;
    }
  });

  it('calls fetchHabits on mount', () => {
    renderPage();

    expect(mockFetchHabits).toHaveBeenCalled();
  });

  it('adds a temporary random icon to a group and persists it', async () => {
    mockFetchHabits.mockResolvedValue({
      habits: [],
      groups: [{ id: 'morning', name: 'Morning routine', icon: null, orderValue: 0 }],
    });
    mockApiUpdateHabitGroup.mockResolvedValue({
      id: 'morning',
      name: 'Morning routine',
      icon: '☀️',
      orderValue: 0,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle icon for Morning routine' }));

    await waitFor(() =>
      expect(mockApiUpdateHabitGroup).toHaveBeenCalledWith('morning', { icon: '☀️' }),
    );
  });

  it('marks a parent and its sub-habits with one completion request', async () => {
    mockFetchHabits.mockResolvedValue({
      habits: [
        { id: 'parent', name: 'Morning', parentId: null, groupId: null, orderValue: 0, completions: [] },
        { id: 'child-1', name: 'Water', parentId: 'parent', groupId: null, orderValue: 0, completions: [] },
        { id: 'child-2', name: 'Stretch', parentId: 'parent', groupId: null, orderValue: 1, completions: [] },
      ],
      groups: [],
    });
    mockApiToggleHabitCompletion.mockResolvedValue({ habitId: 'parent', date: '2026-07-26', isCompleted: true });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Toggle first habit day' }));

    await waitFor(() =>
      expect(mockApiToggleHabitCompletion).toHaveBeenCalledWith('parent', '2026-07-26', true),
    );
    expect(mockApiToggleHabitCompletion).toHaveBeenCalledTimes(1);
  });
});
