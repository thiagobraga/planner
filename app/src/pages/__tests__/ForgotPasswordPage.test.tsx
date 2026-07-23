import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ApiError, apiRequestPasswordReset } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiRequestPasswordReset: vi.fn(),
}));

const mockRequest = vi.mocked(apiRequestPasswordReset);

const CONFIRMATION = /If an account exists for that address/;

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

function submit(email = 'user@example.com') {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
}

beforeEach(() => {
  mockRequest.mockReset();
});

describe('ForgotPasswordPage', () => {
  it('renders the email field and submit button', () => {
    renderPage();

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('shows the generic confirmation on success', async () => {
    mockRequest.mockResolvedValueOnce({ message: 'If an account exists, a reset email has been sent' });
    renderPage();

    submit();

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledWith('user@example.com');
  });

  // The server answers identically for known and unknown addresses on purpose.
  // If the UI rendered an error state when the request failed, the difference
  // between the two outcomes would leak whether the account exists.
  it('shows the same confirmation when the request fails', async () => {
    mockRequest.mockRejectedValueOnce(
      new ApiError({ message: 'Server exploded', code: 'INTERNAL_ERROR', status: 500 }),
    );
    renderPage();

    submit();

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByText('Server exploded')).not.toBeInTheDocument();
  });

  it('shows a countdown when rate limited, without confirming', async () => {
    mockRequest.mockRejectedValueOnce(
      new ApiError({
        message: 'Too many password reset requests. Please try again later.',
        code: 'RATE_LIMITED',
        status: 429,
        retryAfterSeconds: 3600,
      }),
    );
    renderPage();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 60 minutes.');
    expect(screen.queryByText(CONFIRMATION)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
    });
  });
});
