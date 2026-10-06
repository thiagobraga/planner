import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectedAppsSection } from '../ConnectedAppsSection';
import { apiDisconnectApp, fetchConnectedApps } from '../../../api/client';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  fetchConnectedApps: vi.fn(),
  apiDisconnectApp: vi.fn(),
}));

const mockFetch = vi.mocked(fetchConnectedApps);
const mockDisconnect = vi.mocked(apiDisconnectApp);

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConnectedAppsSection />
    </QueryClientProvider>,
  );
}

describe('ConnectedAppsSection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDisconnect.mockReset();
  });

  it('renders nothing until an app is connected', async () => {
    mockFetch.mockResolvedValue([]);
    const { container } = renderSection();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('lists apps and disconnects one after confirmation', async () => {
    mockFetch.mockResolvedValue([
      { id: 'g1', clientName: 'Claude', clientUri: 'https://claude.ai', scopes: ['read', 'write'], createdAt: '2026-10-01T00:00:00Z', lastUsedAt: null },
    ]);
    mockDisconnect.mockResolvedValue(undefined);
    renderSection();

    const list = await screen.findByRole('list', { name: 'Connected apps' });
    expect(list).toHaveTextContent('Claude');
    expect(list).toHaveTextContent('Read & write');

    fireEvent.click(within(list).getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(mockDisconnect).toHaveBeenCalledWith('g1'));
  });
});
