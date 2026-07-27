import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseOnlineStatus = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: (isAuthenticated: boolean) => mockUseOnlineStatus(isAuthenticated),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { OfflineIndicator } from '../OfflineIndicator';

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('OfflineIndicator', () => {
  beforeEach(() => {
    setNavigatorOnLine(true);
  });

  it('renders nothing when online', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseOnlineStatus.mockReturnValue(true);
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the offline message when the browser reports no connection', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseOnlineStatus.mockReturnValue(false);
    setNavigatorOnLine(false);
    render(<OfflineIndicator />);
    // Debounce is 500ms for a browser-level outage, wait for the element.
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        "Offline. Changes sync automatically when you're back online.",
      );
    });
  });

  // A dropped socket on a live connection is usually a reconnect away (see
  // utils/socket.ts). Announcing it at 500ms would flash a banner every deploy
  // and every session revalidation sweep.
  describe('socket-only outage', () => {
    it('stays quiet while a reconnect is still plausible', async () => {
      vi.useFakeTimers();
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
      mockUseOnlineStatus.mockReturnValue(false);

      render(<OfflineIndicator />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.queryByRole('status')).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(screen.getByRole('status')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  it('passes isAuthenticated from useAuth through to useOnlineStatus', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseOnlineStatus.mockReturnValue(true);
    render(<OfflineIndicator />);
    expect(mockUseOnlineStatus).toHaveBeenCalledWith(false);
  });
});
