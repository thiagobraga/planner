import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockUseOnlineStatus = vi.fn();

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

import { OfflineIndicator } from '../OfflineIndicator';

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    mockUseOnlineStatus.mockReturnValue(true);
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the offline message when offline', () => {
    mockUseOnlineStatus.mockReturnValue(false);
    render(<OfflineIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline — changes will sync when reconnected.');
  });
});
