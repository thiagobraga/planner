import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPage } from '../SettingsPage';
import { apiUpdatePreferences, fetchPreferences, type Preferences } from '../../api/client';
import { ensureFontLoaded } from '../../utils/fontLoader';

const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockUpdatePreferences = vi.mocked(apiUpdatePreferences);
const mockEnsureFontLoaded = vi.mocked(ensureFontLoaded);
const originalSupportedValuesOf = (Intl as typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
}).supportedValuesOf;
const originalDateTimeFormat = Intl.DateTimeFormat;

const basePreferences: Preferences = {
  userId: 'user-1',
  timeZone: 'Europe/London',
  weekStart: 'sunday',
  theme: 'system',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
};

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchPreferences: vi.fn(),
  apiUpdatePreferences: vi.fn(),
}));

vi.mock('../../utils/fontLoader', () => ({
  ensureFontLoaded: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="settings-location">{location.pathname}</output>;
}

function renderPage(initialPath = '/settings') {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
          <Route
            path="/settings/:section"
            element={
              <>
                <SettingsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockIntl() {
  Object.defineProperty(Intl, 'supportedValuesOf', {
    configurable: true,
    value: vi.fn(() => ['America/New_York', 'America/Los_Angeles', 'Europe/London']),
  });

  Object.defineProperty(Intl, 'DateTimeFormat', {
    configurable: true,
    value: vi.fn(() => ({
      resolvedOptions: () => ({ timeZone: 'America/Sao_Paulo' }),
    })),
  });
}

beforeEach(() => {
  mockFetchPreferences.mockReset();
  mockUpdatePreferences.mockReset();
  mockEnsureFontLoaded.mockReset();
  mockFetchPreferences.mockResolvedValue(basePreferences);
  mockUpdatePreferences.mockImplementation(async (patch) => ({ ...basePreferences, ...patch }));
  mockIntl();
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(Intl, 'supportedValuesOf', {
    configurable: true,
    value: originalSupportedValuesOf,
  });
  Object.defineProperty(Intl, 'DateTimeFormat', {
    configurable: true,
    value: originalDateTimeFormat,
  });
});

describe('SettingsPage', () => {
  it('defaults to the General panel and exposes its canonical URL', async () => {
    renderPage();

    await screen.findByLabelText('Time zone');
    const [generalTab] = screen.getAllByRole('tab', { name: 'General' });
    const [appearanceTab] = screen.getAllByRole('tab', { name: 'Appearance' });

    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    expect(appearanceTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings/general');
    expect(appearanceTab).toHaveAttribute('title', 'Appearance');
    expect(generalTab).toHaveAttribute('title', 'General');
    expect(screen.getByRole('switch', { name: /Hide completed tasks/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Hide old notes/ })).toBeInTheDocument();
  });

  it('switches panels and URLs with keyboard tab navigation', async () => {
    renderPage('/settings/general');

    const [generalTab] = await screen.findAllByRole('tab', { name: 'General' });
    const [appearanceTab] = await screen.findAllByRole('tab', { name: 'Appearance' });

    generalTab.focus();
    fireEvent.keyDown(generalTab, { key: 'ArrowRight' });

    await waitFor(() => expect(appearanceTab).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings/appearance');
    expect(appearanceTab).toHaveFocus();
    expect(generalTab).toHaveAttribute('aria-selected', 'false');
  });

  it('redirects the legacy behavior route to General', async () => {
    renderPage('/settings/behavior');

    await screen.findByText('Hide completed tasks');
    await waitFor(() => expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings/general'));
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
  });

  it('filters time zones, saves a selected zone, and updates week start', async () => {
    renderPage();

    const timeZoneInput = await screen.findByLabelText('Time zone');
    expect(timeZoneInput).toHaveValue('Europe/London');

    fireEvent.change(timeZoneInput, { target: { value: 'America' } });

    const timeZoneOptions = Array.from(document.querySelectorAll('datalist option')).map((option) =>
      option.getAttribute('value'),
    );
    expect(timeZoneOptions).toContain('America/New_York');
    expect(timeZoneOptions).toContain('America/Los_Angeles');
    expect(timeZoneOptions).not.toContain('Europe/London');

    fireEvent.change(timeZoneInput, { target: { value: 'UTC' } });

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ timeZone: 'UTC' }));

    const monday = screen.getByRole('radio', { name: 'Monday' });
    fireEvent.click(monday);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ weekStart: 'monday' }));
    expect(monday).toBeChecked();
  });

  it('keeps appearance controls working and rolls back failed optimistic updates', async () => {
    mockUpdatePreferences.mockImplementationOnce(async (patch) => ({ ...basePreferences, ...patch }));
    renderPage('/settings/appearance');

    await screen.findByText('Typography');
    const playpen = screen.getByRole('radio', { name: 'Playpen Sans' });
    fireEvent.click(playpen);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ font: 'playpen' }));
    expect(mockEnsureFontLoaded).toHaveBeenCalledWith('playpen');

    mockUpdatePreferences.mockRejectedValueOnce(new Error('nope'));

    const whiteBackground = screen.getByRole('radio', { name: 'White' });
    const beigeBackground = screen.getByRole('radio', { name: 'Beige' });
    fireEvent.click(whiteBackground);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ background: 'white' }));
    await waitFor(() => expect(whiteBackground).toHaveAttribute('aria-checked', 'false'));
    expect(beigeBackground).toHaveAttribute('aria-checked', 'true');
  });

  it('saves behavior toggles and rolls back failed optimistic updates', async () => {
    mockUpdatePreferences.mockImplementationOnce(async (patch) => ({ ...basePreferences, ...patch }));
    renderPage('/settings/general');

    const hideCompleted = await screen.findByRole('switch', { name: /Hide completed tasks/ });
    fireEvent.click(hideCompleted);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ hideCompletedTasks: true }));
    await waitFor(() => expect(hideCompleted).toHaveAttribute('aria-checked', 'true'));

    mockUpdatePreferences.mockRejectedValueOnce(new Error('nope'));

    const hideOldNotes = screen.getByRole('switch', { name: /Hide old notes/ });
    fireEvent.click(hideOldNotes);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ hideOldNotes: true }));
    await waitFor(() => expect(hideOldNotes).toHaveAttribute('aria-checked', 'false'));
    expect(hideCompleted).toHaveAttribute('aria-checked', 'true');
  });
});
