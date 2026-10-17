import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountDataSection } from '../AccountDataSection';
import { apiDeleteAccount, apiExportAccountData } from '../../../api/client';
import { notifyUnauthorized } from '../../../utils/authEvents';
import type { AccountExportData } from '../../../types/account';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  apiExportAccountData: vi.fn(),
  apiDeleteAccount: vi.fn(),
}));

vi.mock('../../../utils/authEvents', () => ({
  notifyUnauthorized: vi.fn(),
}));

const mockExport = vi.mocked(apiExportAccountData);
const mockDelete = vi.mocked(apiDeleteAccount);
const mockNotifyUnauthorized = vi.mocked(notifyUnauthorized);

const sampleExport: AccountExportData = {
  user: {
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: '2026-08-07T00:00:00.000Z',
  },
  preferences: null,
  collections: [],
  tasks: [],
  labels: [],
  sections: [],
  habits: [],
  habitCompletions: [],
  filters: [],
  comments: [],
  reminders: [],
};

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}</output>;
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings/general']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AccountDataSection />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountDataSection', () => {
  beforeEach(() => {
    mockExport.mockReset();
    mockDelete.mockReset();
    mockNotifyUnauthorized.mockReset();
  });

  it('renders export and delete buttons and legal links', () => {
    renderSection();

    expect(screen.getByText('Data & Privacy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  });

  it('exports account data as a JSON file download when Export data is clicked', async () => {
    mockExport.mockResolvedValueOnce(sampleExport);

    const createObjectURL = vi.fn(() => 'blob:planner-export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Export data' }));

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledTimes(1);
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:planner-export');

    clickSpy.mockRestore();
  });

  it('opens confirmation modal and deletes account on confirm', async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete account?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
    expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-location')).toHaveTextContent('/login');
  });
});
