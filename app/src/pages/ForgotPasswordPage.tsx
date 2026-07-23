import { useState } from 'react';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError, apiRequestPasswordReset } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

const GENERIC_CONFIRMATION =
  'If an account exists for that address, a reset link is on its way. Check your inbox.';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { secondsLeft, start } = useCountdown();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);
    try {
      await apiRequestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      // Rate limiting is about this IP, not this account, so a countdown here
      // reveals nothing. Every other failure falls through to the same
      // confirmation the success path shows: branching on it would tell an
      // attacker whether the address is registered, which is exactly what the
      // server's uniform response is there to prevent.
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        start(err.retryAfterSeconds ?? 0);
        setFormError(err.message);
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell subtitle="Check your inbox">
        <p className="text-[13px] leading-6 text-ink text-center">{GENERIC_CONFIRMATION}</p>
        <p className="mt-6 text-center">
          <AuthLink to="/login">Back to sign in</AuthLink>
        </p>
      </AuthShell>
    );
  }

  const throttled = secondsLeft > 0;

  return (
    <AuthShell subtitle="Reset your password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-[13px] leading-6 text-ink-light">
          Enter your email and we'll send you a link to choose a new password.
        </p>
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

        {formError && (
          <AuthFormError>
            {throttled ? `${formError} Try again in ${formatCountdown(secondsLeft)}.` : formError}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthShell>
  );
}
