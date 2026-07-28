import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { UpdateToast } from '../UpdateToast';
import { I18nProvider } from '../../i18n/I18nContext';

function renderWithI18n(updateAvailable = false) {
  return render(
    <I18nProvider>
      <UpdateToast updateAvailable={updateAvailable} />
    </I18nProvider>,
  );
}

describe('UpdateToast', () => {
  it('renders nothing when no update is available', () => {
    const { container } = renderWithI18n();
    expect(container.firstChild).toBeNull();
  });

  it('shows the toast with a refresh action when an update is available', () => {
    renderWithI18n(true);
    expect(screen.getByRole('status')).toHaveTextContent('New version available');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('reloads the page when the refresh action is clicked', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    renderWithI18n(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Refresh' })[0]!);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
