import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegisterPage } from '../RegisterPage';
import { ApiError } from '../../api/client';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'Correct-horse-battery-staple-2' },
  });
}

beforeEach(() => {
  mockRegister.mockReset();
  mockNavigate.mockReset();
});

describe('RegisterPage', () => {
  it('renders the account fields and the submit button', () => {
    renderPage();

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Display name (optional)')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Password requirements' })).toBeInTheDocument();
    expect(screen.getByText('Uppercase and lowercase letters')).toBeInTheDocument();
    expect(screen.getByText('At least one number')).toBeInTheDocument();
    expect(screen.getByText('At least one symbol')).toBeInTheDocument();
  });

  it('marks password requirements as they are met', () => {
    renderPage();

    const passwordInput = screen.getByPlaceholderText('Password');
    const lengthRequirement = screen.getByRole('listitem', {
      name: 'At least 15 characters: not met',
    });
    const commonRequirement = screen.getByRole('listitem', {
      name: 'Avoid passwords like planner, password, admin...: not met',
    });

    expect(lengthRequirement).toHaveAttribute('data-met', 'false');
    expect(commonRequirement).toHaveAttribute('data-met', 'false');

    fireEvent.change(passwordInput, { target: { value: 'Correct-horse-battery-staple-2' } });

    expect(lengthRequirement).toHaveAttribute('data-met', 'true');
    expect(commonRequirement).toHaveAttribute('data-met', 'true');
    expect(lengthRequirement).toHaveTextContent('×');
    expect(commonRequirement).toHaveTextContent('×');
    expect(
      screen.getByRole('listitem', { name: 'Uppercase and lowercase letters: met' }),
    ).toHaveTextContent('×');
    expect(screen.getByRole('listitem', { name: 'At least one number: met' })).toHaveTextContent('×');
    expect(screen.getByRole('listitem', { name: 'At least one symbol: met' })).toHaveTextContent('×');

    fireEvent.change(passwordInput, { target: { value: 'planner-planner-planner' } });

    expect(lengthRequirement).toHaveAttribute('data-met', 'true');
    expect(commonRequirement).toHaveAttribute('data-met', 'false');
    expect(commonRequirement).toHaveTextContent('•');
  });

  it('shows and hides the password', () => {
    renderPage();

    const passwordInput = screen.getByPlaceholderText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('registers and navigates to /daily on success', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'new@example.com',
        'Correct-horse-battery-staple-2',
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/daily', { replace: true });
  });

  it('places VALIDATION_ERROR details on the matching fields', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        status: 400,
        details: [
          { field: 'email', message: 'Email must be a valid RFC 5322 address' },
          { field: 'password', message: 'Password does not meet strength requirements' },
        ],
      }),
    );
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email must be a valid RFC 5322 address')).toBeInTheDocument();
    expect(
      screen.getByText('Password does not meet strength requirements'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows EMAIL_IN_USE on the email field', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({
        message: 'An account with this email already exists',
        code: 'EMAIL_IN_USE',
        status: 409,
      }),
    );
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
  });

  it('falls back to a form-level message for an unrecognised code', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({ message: 'Server exploded', code: 'INTERNAL_ERROR', status: 500 }),
    );
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
  });
});

describe('RegisterPage - rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from retryAfterSeconds and re-enables submit at zero', async () => {
    mockRegister.mockRejectedValueOnce(
      new ApiError({
        message: 'Too many registration attempts. Please try again later.',
        code: 'RATE_LIMITED',
        status: 429,
        retryAfterSeconds: 2,
      }),
    );
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Try again in 2 seconds.');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 1 second.');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled();
    });
  });
});
