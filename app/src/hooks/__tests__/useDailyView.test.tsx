import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../../types/api';
import type { ViewLayout } from '../../types/view';

const apiUpdatePreferences = vi.fn();
vi.mock('../../api/client', () => ({ apiUpdatePreferences: (patch: unknown) => apiUpdatePreferences(patch) }));

const { useDailyView } = await import('../useDailyView');

const TODAY = '2026-11-14'; // Saturday
const prefs = { weekStart: 'sunday', dailyView: { style: 'notebook', range: 'week' } } as Preferences;

const current = { path: '' };
function PathProbe() {
  current.path = useLocation().pathname;
  return null;
}

function setup(layout: ViewLayout, preferences: Preferences = prefs) {
  const client = new QueryClient();
  client.setQueryData(['preferences'], preferences);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/daily/${layout}`]}>
        <Routes><Route path="/daily/:view" element={<><PathProbe />{children}</>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...renderHook(() => useDailyView(layout, preferences, TODAY), { wrapper }) };
}

describe('useDailyView', () => {
  beforeEach(() => {
    apiUpdatePreferences.mockReset();
    apiUpdatePreferences.mockImplementation(async (patch: Partial<Preferences>) => ({ ...prefs, ...patch }));
  });

  it('resolves the saved range around today', () => {
    const { result } = setup('list');
    expect(result.current).toMatchObject({ style: 'notebook', range: 'week', from: '2026-11-08', to: '2026-11-14', includesToday: true });
  });

  it('coerces a saved preset to a span on Columns', () => {
    const { result } = setup('columns');
    expect(result.current.range).toBe('w1');
  });

  it('moves the anchor by whole ranges and back to today', () => {
    const { result } = setup('list');
    act(() => result.current.next());
    expect(result.current).toMatchObject({ from: '2026-11-15', to: '2026-11-21', includesToday: false });
    act(() => result.current.today());
    expect(result.current.from).toBe('2026-11-08');
    act(() => result.current.pick('2026-12-25'));
    expect(result.current.from).toBe('2026-12-20');
  });

  it('saves style and range changes as one Daily view preference', async () => {
    const { result, client } = setup('columns');
    act(() => result.current.setRangeByShortcut('3'));
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ dailyView: { style: 'notebook', range: 'd3' } });
    await waitFor(() => expect(client.getQueryData<Preferences>(['preferences'])?.dailyView?.range).toBe('d3'));
    act(() => result.current.toggleStyle());
    expect(apiUpdatePreferences).toHaveBeenLastCalledWith({ dailyView: { style: 'cards', range: 'w1' } });
  });

  it('navigates to the new layout and saves the coerced range', async () => {
    const { result } = setup('list', { ...prefs, dailyView: { style: 'cards', range: 'month' } } as Preferences);
    act(() => result.current.setLayout('columns'));
    await waitFor(() => expect(current.path).toBe('/daily/columns'));
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ dailyView: { style: 'cards', range: 'w3' } });
  });
});
