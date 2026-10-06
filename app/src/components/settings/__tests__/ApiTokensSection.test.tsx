import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiTokensSection } from '../ApiTokensSection';
import { apiCreateApiToken, apiRevokeApiToken, fetchApiTokens } from '../../../api/client';
import type { ApiToken } from '../../../types/apiToken';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  fetchApiTokens: vi.fn(),
  apiCreateApiToken: vi.fn(),
  apiRevokeApiToken: vi.fn(),
}));

const mockFetch = vi.mocked(fetchApiTokens);
const mockCreate = vi.mocked(apiCreateApiToken);
const mockRevoke = vi.mocked(apiRevokeApiToken);

const token: ApiToken = {
  id: 'tok-1',
  name: 'Claude Desktop',
  tokenPrefix: 'plnr_abcd1234',
  scopes: ['read', 'write'],
  createdAt: '2026-10-01T12:00:00.000Z',
  lastUsedAt: null,
  expiresAt: null,
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApiTokensSection />
    </QueryClientProvider>,
  );
}

describe('ApiTokensSection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCreate.mockReset();
    mockRevoke.mockReset();
  });

  it('shows an empty state when there are no tokens', async () => {
    mockFetch.mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText('No tokens yet.')).toBeInTheDocument();
  });

  it('lists tokens with prefix, access, usage and expiry', async () => {
    mockFetch.mockResolvedValue([token]);
    renderSection();

    const list = await screen.findByRole('list', { name: 'API tokens' });
    expect(within(list).getByText('Claude Desktop')).toBeInTheDocument();
    const meta = within(list).getByText(/plnr_abcd1234/);
    expect(meta).toHaveTextContent('Read & write');
    expect(meta).toHaveTextContent('Never used');
    expect(meta).toHaveTextContent('No expiry');
  });

  it('creates a read-only token by default and reveals the secret once', async () => {
    mockFetch.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ token, rawToken: 'plnr_secret-value' });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /New token/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Claude Desktop on laptop'), { target: { value: '  My agent ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ name: 'My agent', scopes: ['read'], expiresInDays: 90 }),
    );
    expect(await screen.findByDisplayValue('plnr_secret-value')).toBeInTheDocument();
    expect(screen.getByText("Copy this token now. You won't be able to see it again.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByDisplayValue('plnr_secret-value')).not.toBeInTheDocument();
  });

  it('sends write scope and never-expiring choice', async () => {
    mockFetch.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ token, rawToken: 'plnr_x' });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /New token/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Claude Desktop on laptop'), { target: { value: 'Writer' } });
    fireEvent.click(screen.getByLabelText('Read & write'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'never' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Writer', scopes: ['read', 'write'], expiresInDays: null }),
    );
  });

  it('shows the server error when creation fails', async () => {
    mockFetch.mockResolvedValue([]);
    mockCreate.mockRejectedValue(new Error('You can have at most 20 active tokens. Revoke one first.'));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /New token/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Claude Desktop on laptop'), { target: { value: 'One too many' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('at most 20 active tokens');
  });

  it('revokes a token only after confirmation', async () => {
    mockFetch.mockResolvedValue([token]);
    mockRevoke.mockResolvedValue(undefined);
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Anything using "Claude Desktop" will stop working immediately.');
    expect(mockRevoke).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('tok-1'));
  });
});
