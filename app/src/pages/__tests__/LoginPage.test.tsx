import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from '../LoginPage';

const mockLogin = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

beforeEach(() => {
  mockLogin.mockReset();
});

describe('LoginPage', () => {
  it('renders email and password inputs and sign in button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows Planner branding', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Bulletjournal online')).toBeInTheDocument();
  });

  it('calls login and navigates on successful submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'strongpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'strongpassword123');
    });
  });

  it('shows loading state while submitting', async () => {
    mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('…');
    });
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('Invalid credentials');
  });

  it('shows generic error for non-Error failures', async () => {
    mockLogin.mockRejectedValueOnce('string error');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText('Something went wrong');
  });

  it('returns to a same-origin ?next= path after signing in, ignoring other sites', async () => {
    function Where() {
      const location = useLocation();
      return <output data-testid="where">{location.pathname + location.search}</output>;
    }
    const signIn = async (next: string) => {
      mockLogin.mockResolvedValueOnce(undefined);
      const view = render(
        <MemoryRouter initialEntries={[`/login?next=${encodeURIComponent(next)}`]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'strongpassword123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      const where = (await screen.findByTestId('where')).textContent;
      view.unmount();
      return where;
    };

    expect(await signIn('/oauth/consent?request=abc')).toBe('/oauth/consent?request=abc');
    expect(await signIn('//evil.example/steal')).toBe('/daily');
  });
});
