import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePreferences } from '../usePreferences';
import type { Preferences } from '../../types/api';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchPreferences: vi.fn(),
}));

import { fetchPreferences } from '../../api/client';
const mockFetchPreferences = vi.mocked(fetchPreferences);

const defaultPreferences: Preferences = {
  userId: 'user-1',
  locale: 'en',
  timeZone: 'UTC',
  weekStart: 'monday',
  theme: 'light',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  showNotes: true,
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderUsePreferences() {
  const queryClient = createQueryClient();
  return renderHook(() => usePreferences(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('usePreferences', () => {
  beforeEach(() => {
    mockFetchPreferences.mockReset();
  });

  it('returns preferences data when loaded', async () => {
    mockFetchPreferences.mockResolvedValue(defaultPreferences);

    const { result } = renderUsePreferences();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(defaultPreferences);
    expect(mockFetchPreferences).toHaveBeenCalledTimes(1);
  });

  it('enters error state when fetch fails', async () => {
    mockFetchPreferences.mockRejectedValue(new Error('Network error'));

    const { result } = renderUsePreferences();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('shares cached preferences and updates all subscribers after invalidation', async () => {
    const updated = { ...defaultPreferences, weekStart: 'sunday' as const };
    mockFetchPreferences.mockResolvedValueOnce(defaultPreferences).mockResolvedValueOnce(updated);
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const first = renderHook(() => usePreferences(), { wrapper });
    const second = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => expect(second.result.current.data).toEqual(defaultPreferences));
    expect(mockFetchPreferences).toHaveBeenCalledTimes(1);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['preferences'] });
    });

    await waitFor(() => expect(first.result.current.data).toEqual(updated));
    expect(second.result.current.data).toEqual(updated);
    expect(mockFetchPreferences).toHaveBeenCalledTimes(2);
  });
});
