import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { secondsLeft, start } = useCountdown();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/daily', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        start(err.retryAfterSeconds ?? 0);
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const throttled = secondsLeft > 0;

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          aria-label="Email"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          aria-label="Password"
        />

        {error && (
          <AuthFormError>
            {throttled ? `${error} Try again in ${formatCountdown(secondsLeft)}.` : error}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1">
        <AuthLink to="/forgot-password">Forgot password?</AuthLink>
        <AuthLink to="/register">Don't have an account? Register</AuthLink>
      </div>
    </AuthShell>
  );
}
