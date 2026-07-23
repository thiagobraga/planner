import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { secondsLeft, start } = useCountdown();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
      navigate('/daily', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_ERROR') {
          setFieldErrors(Object.fromEntries(err.fieldErrors().map((d) => [d.field, d.message])));
        } else if (err.code === 'EMAIL_IN_USE') {
          setFieldErrors({ email: err.message });
        } else if (err.code === 'RATE_LIMITED') {
          start(err.retryAfterSeconds ?? 0);
          setFormError(err.message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const throttled = secondsLeft > 0;

  return (
    <AuthShell subtitle="Create your account">
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
          error={Boolean(fieldErrors.email)}
          errorText={fieldErrors.email}
        />
        <Input
          type="text"
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          aria-label="Display name"
          error={Boolean(fieldErrors.displayName)}
          errorText={fieldErrors.displayName}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          aria-label="Password"
          error={Boolean(fieldErrors.password)}
          errorText={fieldErrors.password}
        />

        {formError && (
          <AuthFormError>
            {throttled ? `${formError} Try again in ${formatCountdown(secondsLeft)}.` : formError}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">Already have an account? Sign in</AuthLink>
      </p>
    </AuthShell>
  );
}
