import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preferences } from '../../types/api';

const apiUpdatePreferences = vi.fn();
vi.mock('../../api/client', () => ({ apiUpdatePreferences: (patch: unknown) => apiUpdatePreferences(patch) }));
vi.mock('../DailyPage', () => ({
  DailyPage: ({ layout }: { layout: string }) => <div data-testid="daily-page">{layout}</div>,
}));

const { DailyIndexRedirect, DailyRoute } = await import('../DailyRoutes');

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  const client = new QueryClient();
  client.setQueryData(['preferences'], { dailyView: { style: 'notebook', range: 'today' } } as Preferences);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/daily" element={<DailyIndexRedirect />} />
          <Route path="/daily/:view" element={<><DailyRoute /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Daily routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiUpdatePreferences.mockReset();
    apiUpdatePreferences.mockResolvedValue({});
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
