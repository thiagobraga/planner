import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preferences } from '../../../api/client';

const mockUpdatePreferences = vi.hoisted(() => vi.fn());

vi.mock('../../../api/client', () => ({
  fetchPreferences: vi.fn(),
  apiUpdatePreferences: mockUpdatePreferences,
}));

import { ThemeSwitcher } from '../ThemeSwitcher';

const basePreferences = { background: 'beige' } as Preferences;

function renderSwitcher(preferences: Preferences = basePreferences) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(['preferences'], preferences);
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeSwitcher />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    mockUpdatePreferences.mockReset();
  });

  it('offers one swatch per color theme under a Theme label', () => {
    renderSwitcher();

    expect(screen.getByText('Theme')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Beige',
      'White',
      'Dark',
    ]);
  });

  it('marks the current theme as checked', () => {
    renderSwitcher({ ...basePreferences, background: 'white' });

    expect(screen.getByRole('radio', { name: 'White' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beige' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the picked theme and applies it optimistically', async () => {
    mockUpdatePreferences.mockImplementation(async (patch) => ({ ...basePreferences, ...patch }));
    const queryClient = renderSwitcher();

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(queryClient.getQueryData<Preferences>(['preferences'])?.background).toBe('dark'));
    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ background: 'dark' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('rolls back when saving fails', async () => {
    mockUpdatePreferences.mockRejectedValue(new Error('nope'));
    renderSwitcher();

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Beige' })).toHaveAttribute('aria-checked', 'true'));
  });
});
