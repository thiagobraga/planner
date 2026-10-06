import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthConsentPage } from '../OAuthConsentPage';
import { apiDecideOAuthRequest, fetchOAuthRequest } from '../../api/client';
import type { PendingAuthorization } from '../../types/oauth';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchOAuthRequest: vi.fn(),
  apiDecideOAuthRequest: vi.fn(),
}));

const mockFetch = vi.mocked(fetchOAuthRequest);
const mockDecide = vi.mocked(apiDecideOAuthRequest);
const assign = vi.fn();
const originalLocation = window.location;

const pending: PendingAuthorization = {
  id: 'req-1',
  clientName: 'Claude',
  clientUri: 'https://claude.ai',
  redirectHost: 'claude.ai',
  scopes: ['read', 'write'],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/oauth/consent?request=req-1']}>
        <OAuthConsentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OAuthConsentPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDecide.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('names the app, where it returns to, and what it can do', async () => {
    mockFetch.mockResolvedValue(pending);
    renderPage();

    expect(await screen.findByText('Claude wants to use your Planner')).toBeInTheDocument();
    expect(screen.getByText('You will be sent back to claude.ai.')).toBeInTheDocument();
    expect(screen.getByText('Create, edit, complete and delete tasks, and log habits')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('req-1');
  });

  it.each([
    ['Allow read & write', 'write'],
    ['Allow read only', 'read'],
    ['Cancel', 'deny'],
  ] as const)('"%s" sends %s and follows the redirect', async (label, decision) => {
    mockFetch.mockResolvedValue(pending);
    mockDecide.mockResolvedValue({ redirectUrl: 'https://claude.ai/cb?code=abc' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: label }));

    await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('req-1', decision));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://claude.ai/cb?code=abc'));
  });

  it('offers only read access when the app did not ask to write', async () => {
    mockFetch.mockResolvedValue({ ...pending, scopes: ['read'] });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Allow read only' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow read & write' })).not.toBeInTheDocument();
    expect(screen.queryByText('Create, edit, complete and delete tasks, and log habits')).not.toBeInTheDocument();
  });

  it('explains an expired request', async () => {
    mockFetch.mockRejectedValue(new Error('gone'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('expired or was already used');
  });
});
