import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyIndexRedirect, DailyRoute } from '../DailyRoutes';

vi.mock('../DailyPage', () => ({
  DailyPage: ({ view }: { view: string }) => <div data-testid="daily-page">{view}</div>,
}));

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/daily" element={<DailyIndexRedirect />} />
        <Route path="/daily/:view" element={<><DailyRoute /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Daily routes', () => {
  beforeEach(() => window.localStorage.clear());

  it.each([
    ['list', 'list'],
    ['kanban', 'kanban-list'],
    ['cards', 'kanban'],
    ['monthly', 'calendar'],
  ])('/daily/%s shows the %s view', (slug, view) => {
    renderAt(`/daily/${slug}`);

    expect(screen.getByTestId('daily-page')).toHaveTextContent(view);
  });

  it('sends an unknown view to the list', () => {
    renderAt('/daily/weekly');

    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
    expect(screen.getByTestId('daily-page')).toHaveTextContent('list');
  });

  it('sends /daily to the list the first time', () => {
    renderAt('/daily');

    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
  });

  it('sends /daily to the last view used', () => {
    const first = renderAt('/daily/monthly');
    first.unmount();

    renderAt('/daily');

    expect(screen.getByTestId('where')).toHaveTextContent('/daily/monthly');
  });

  it('ignores a stored view that no longer exists', () => {
    window.localStorage.setItem('planner.daily.lastView.v1', 'calendar');

    renderAt('/daily');

    expect(screen.getByTestId('where')).toHaveTextContent('/daily/list');
  });

  it('does not remember an unknown view', () => {
    const first = renderAt('/daily/weekly');
    first.unmount();

    expect(window.localStorage.getItem('planner.daily.lastView.v1')).toBe('list');
  });
});
