import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseVersionCheck = vi.fn();

vi.mock('../../hooks/useVersionCheck', () => ({
  useVersionCheck: () => mockUseVersionCheck(),
}));

import { UpdateToast } from '../UpdateToast';
import { I18nProvider } from '../../i18n/I18nContext';

function renderWithI18n() {
  return render(
    <I18nProvider>
      <UpdateToast />
    </I18nProvider>,
  );
}

describe('UpdateToast', () => {
  beforeEach(() => {
    mockUseVersionCheck.mockReset();
  });

  it('renders nothing when no update is available', () => {
    mockUseVersionCheck.mockReturnValue(false);
    const { container } = renderWithI18n();
    expect(container.firstChild).toBeNull();
  });

  it('shows the toast with a refresh action when an update is available', () => {
    mockUseVersionCheck.mockReturnValue(true);
    renderWithI18n();
    expect(screen.getByRole('status')).toHaveTextContent('New version available');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('reloads the page when the refresh action is clicked', () => {
    mockUseVersionCheck.mockReturnValue(true);
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    renderWithI18n();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
