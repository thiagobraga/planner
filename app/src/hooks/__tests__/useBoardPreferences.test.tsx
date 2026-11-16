import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../../types/api';

const apiUpdatePreferences = vi.fn();
vi.mock('../../api/client', () => ({ apiUpdatePreferences: (patch: unknown) => apiUpdatePreferences(patch) }));

const { useBoardPreferences } = await import('../useBoardPreferences');

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function setup(boardViewModes: Preferences['boardViewModes'] = {}) {
  const client = new QueryClient();
  const prefs = { boardViewModes, hideCompletedTasks: true } as Preferences;
  client.setQueryData(['preferences'], prefs);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(
    () => useBoardPreferences(ID, client.getQueryData<Preferences>(['preferences'])),
    { wrapper },
  );
  return { client, ...hook };
}

describe('useBoardPreferences', () => {
  beforeEach(() => {
    apiUpdatePreferences.mockReset();
    apiUpdatePreferences.mockImplementation(async () => ({}));
  });

  it('defaults to List, Notebook, grouped by status', () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ layout: 'list', style: 'notebook', groupBy: 'status', view: 'list' });
  });

  it('maps the saved layout and style to the board presentation', () => {
    expect(setup({ [ID]: { layout: 'columns', style: 'cards' } }).result.current.view).toBe('kanban');
    expect(setup({ [ID]: { layout: 'columns' } }).result.current.view).toBe('kanban-list');
    expect(setup({ [ID]: { layout: 'calendar' } }).result.current.view).toBe('calendar');
  });

  it('sends only the changed field and merges it locally', async () => {
    const { result, client } = setup({ [ID]: { layout: 'columns', groupBy: 'section' }, [OTHER]: { groupBy: 'priority' } });
    act(() => result.current.setStyle('cards'));
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ boardViewModes: { [ID]: { style: 'cards' } } });
    await waitFor(() => expect(client.getQueryData<Preferences>(['preferences'])?.boardViewModes).toEqual({
      [ID]: { layout: 'columns', groupBy: 'section', style: 'cards' },
      [OTHER]: { groupBy: 'priority' },
    }));
  });

  it('asks for completed tasks only for a status board while they are hidden', () => {
    expect(setup({ [ID]: { layout: 'columns', groupBy: 'status' } }).result.current.includeCompleted).toBe(true);
    expect(setup({ [ID]: { layout: 'columns', groupBy: 'priority' } }).result.current.includeCompleted).toBe(false);
    expect(setup({ [ID]: { layout: 'list', groupBy: 'status' } }).result.current.includeCompleted).toBe(false);
  });
});
