import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DailyRoute } from '../DailyRoutes';
import { dailyView } from '../../test/dailyFixtures';
import { I18nProvider } from '../../i18n/I18nContext';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { fetchDaily, fetchPreferences, fetchCollections, type Preferences } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchDaily: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchCollections: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../hooks/useSync', () => ({ useSync: vi.fn() }));
vi.mock('../../hooks/useMidnightTimer', () => ({ useMidnightTimer: vi.fn() }));
vi.mock('../../utils/phrases', () => ({ getPhrase: () => 'Make today count' }));

const mockFetchDaily = vi.mocked(fetchDaily);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockFetchCollections = vi.mocked(fetchCollections);

// Wednesday. Prefs are UTC, so "today" is this date whatever the machine zone.
const NOW = new Date('2026-10-07T12:00:00Z');

const preferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'UTC',
  weekStart: 'sunday',
  theme: 'light',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  showNotes: true,
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <PlannerDragProvider>
            <Routes>
              <Route path="/daily/:view" element={<DailyRoute />} />
              <Route path="*" element={<div data-testid="elsewhere" />} />
            </Routes>
          </PlannerDragProvider>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function requestedRanges(): string[] {
  return mockFetchDaily.mock.calls.map(([from, to]) => `${from}..${to}`);
}

describe('Daily asks for one range per view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    mockFetchPreferences.mockResolvedValue(preferences);
    mockFetchCollections.mockResolvedValue([]);
    mockFetchDaily.mockImplementation(async (from, to) => ({ ...dailyView({}, '2026-10-07'), from, to }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('list asks for today only', async () => {
    renderAt('/daily/list');

    await waitFor(() => expect(requestedRanges()).toEqual(['2026-10-07..2026-10-07']));
  });

  it('list asks for seven days when next days is switched on', async () => {
    renderAt('/daily/list');
    await waitFor(() => expect(mockFetchDaily).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByLabelText(/Next days/));

    await waitFor(() => expect(requestedRanges()).toEqual(['2026-10-07..2026-10-07', '2026-10-07..2026-10-13']));
  });

  it.each(['kanban', 'cards'])('/daily/%s asks for the visible week', async (slug) => {
    renderAt(`/daily/${slug}`);

    await waitFor(() => expect(requestedRanges()).toEqual(['2026-10-04..2026-10-10']));
  });

  it('fetches only the new week when the week changes', async () => {
    renderAt('/daily/cards');
    await screen.findByTestId('daily-week-board');
    await waitFor(() => expect(mockFetchDaily).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    await waitFor(() => expect(requestedRanges()).toEqual(['2026-10-04..2026-10-10', '2026-10-11..2026-10-17']));
  });

  it('list asks for the selected week once the week selector moves away from this one', async () => {
    renderAt('/daily/list');
    await waitFor(() => expect(mockFetchDaily).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    await waitFor(() => expect(requestedRanges().at(-1)).toBe('2026-10-11..2026-10-17'));
    expect(screen.getAllByLabelText('New task…')).toHaveLength(7);
  });

  it.each(['list', 'cards'])('Today brings /daily/%s back to the current period', async (slug) => {
    renderAt(`/daily/${slug}`);
    await waitFor(() => expect(mockFetchDaily).toHaveBeenCalledTimes(1));
    const first = requestedRanges()[0];

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(requestedRanges().at(-1)).not.toBe(first));

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => expect(requestedRanges().at(-1)).toBe(first));
  });

  it('monthly shows the Today button', async () => {
    renderAt('/daily/monthly');

    expect(await screen.findByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('monthly asks for the whole visible month', async () => {
    renderAt('/daily/monthly');

    await waitFor(() => expect(requestedRanges()).toEqual(['2026-10-01..2026-10-31']));
  });

  it('opens the week of the preferred time zone, not the machine zone', async () => {
    // 01:00 UTC on Sunday is still Saturday in São Paulo, so the week is the previous one.
    vi.setSystemTime(new Date('2026-10-11T01:00:00Z'));
    mockFetchPreferences.mockResolvedValue({ ...preferences, timeZone: 'America/Sao_Paulo' });

    renderAt('/daily/cards');

    // The first request can use the machine zone before preferences arrive; the last one is the shown week.
    await waitFor(() => expect(requestedRanges().at(-1)).toBe('2026-10-04..2026-10-10'));
  });
});
