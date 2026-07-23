import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { ApiError, apiConfirmPasswordReset } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiConfirmPasswordReset: vi.fn(),
}));

const mockConfirm = vi.mocked(apiConfirmPasswordReset);

function renderPage(search = '?token=reset-token') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

function submit(password = 'correct-horse-battery-staple') {
  fireEvent.change(screen.getByPlaceholderText('New password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
}

beforeEach(() => {
  mockConfirm.mockReset();
});

describe('ResetPasswordPage', () => {
  it('renders the password field when a token is present', () => {
    renderPage();

    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set new password' })).toBeInTheDocument();
  });

  it('shows the invalid-link state and no form when the token is missing', () => {
    renderPage('');

    expect(screen.getByText(/expired or has already been used/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('confirms the reset and points the user at sign in', async () => {
    mockConfirm.mockResolvedValueOnce({ success: true });
    renderPage();

    submit();

    expect(await screen.findByText(/Your password has been updated/)).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith('reset-token', 'correct-horse-battery-staple');
    // Confirming deletes every session for the account, so there is no session
    // to resume - the page must not pretend the user is logged in.
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the invalid-link state on TOKEN_INVALID', async () => {
    mockConfirm.mockRejectedValueOnce(
      new ApiError({
        message: 'Token is invalid or has expired',
        code: 'TOKEN_INVALID',
        status: 400,
      }),
    );
    renderPage();

    submit();

    expect(await screen.findByText(/expired or has already been used/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
  });

  it('shows a weak password as a field error', async () => {
    mockConfirm.mockRejectedValueOnce(
      new ApiError({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        status: 400,
        details: [{ field: 'newPassword', message: 'Password is too weak' }],
      }),
    );
    renderPage();

    submit('short');

    expect(await screen.findByText('Password is too weak')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
  });

  it('falls back to a form-level message for an unrecognised code', async () => {
    mockConfirm.mockRejectedValueOnce(
      new ApiError({ message: 'Server exploded', code: 'INTERNAL_ERROR', status: 500 }),
    );
    renderPage();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
  });
});
