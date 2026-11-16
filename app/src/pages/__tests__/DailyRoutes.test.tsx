import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preferences } from '../../types/api';

const apiUpdatePreferences = vi.fn();
const fetchPreferences = vi.fn();
vi.mock('../../api/client', () => ({
  apiUpdatePreferences: (patch: unknown) => apiUpdatePreferences(patch),
  fetchPreferences: () => fetchPreferences(),
}));
vi.mock('../DailyPage', () => ({
  DailyPage: ({ layout }: { layout: string }) => <div data-testid="daily-page">{layout}</div>,
}));

const { DailyIndexRedirect, DailyRoute } = await import('../DailyRoutes');

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string, { cached = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cached) client.setQueryData(['preferences'], { dailyView: { style: 'notebook', range: 'today' } } as Preferences);
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/daily" element={<DailyIndexRedirect />} />
          <Route path="/daily/:view" element={<><DailyRoute /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return Object.assign(view, { client });
}

describe('Daily routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiUpdatePreferences.mockReset();
    apiUpdatePreferences.mockResolvedValue({});
    fetchPreferences.mockReset();
  });

  it.each(['list', 'columns'])('/daily/%s shows that layout', (slug) => {
    renderAt(`/daily/${slug}`);
    expect(screen.getByTestId('daily-page')).toHaveTextContent(slug);
  });

  it.each([
    ['kanban', 'columns', { style: 'notebook', range: 'today' }],
    ['cards', 'columns', { style: 'cards', range: 'today' }],
    ['monthly', 'list', { style: 'notebook', range: 'month' }],
  ])('sends the old /daily/%s to %s and keeps what it used to show', async (slug, layout, dailyView) => {
    renderAt(`/daily/${slug}`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/daily/${layout}`));
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ dailyView });
  });

  it('on a fresh load, merges into the saved view and shows it before the save returns', async () => {
    fetchPreferences.mockResolvedValue({ dailyView: { style: 'cards', range: 'week' } } as Preferences);
    let finishSave: (value: unknown) => void = () => {};
    apiUpdatePreferences.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    const { client } = renderAt('/daily/monthly', { cached: false });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/daily/list'));
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ dailyView: { style: 'cards', range: 'month' } });
    expect(client.getQueryData<Preferences>(['preferences'])?.dailyView).toEqual({ style: 'cards', range: 'month' });
    await act(async () => finishSave({ dailyView: { style: 'cards', range: 'month' } }));
  });

  it('still redirects when preferences cannot load', async () => {
    fetchPreferences.mockRejectedValue(new Error('offline'));
    renderAt('/daily/monthly', { cached: false });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/daily/list'));
    expect(apiUpdatePreferences).not.toHaveBeenCalled();
  });

  it('sends an unknown view to the list', () => {
    renderAt('/daily/weekly');
    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
  });

  it('sends /daily to the list the first time', () => {
    renderAt('/daily');
    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
  });

  it('sends /daily to the last layout used', () => {
    renderAt('/daily/columns').unmount();
    renderAt('/daily');
    expect(screen.getByTestId('where')).toHaveTextContent('/daily/columns');
  });

  it('ignores a stored layout that no longer exists', () => {
    window.localStorage.setItem('planner.daily.lastLayout.v2', 'kanban');
    renderAt('/daily');
    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
  });
});
