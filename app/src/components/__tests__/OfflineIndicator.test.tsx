import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockUseOnlineStatus = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: (isAuthenticated: boolean) => mockUseOnlineStatus(isAuthenticated),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { OfflineIndicator } from '../OfflineIndicator';

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseOnlineStatus.mockReturnValue(true);
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the offline message when offline', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseOnlineStatus.mockReturnValue(false);
    render(<OfflineIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Offline. Changes sync automatically when you're back online.",
    );
  });

  it('passes isAuthenticated from useAuth through to useOnlineStatus', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseOnlineStatus.mockReturnValue(true);
    render(<OfflineIndicator />);
    expect(mockUseOnlineStatus).toHaveBeenCalledWith(false);
  });
});
