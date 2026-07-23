import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError, apiConfirmPasswordReset } from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setFormError('');
    setLoading(true);
    try {
      await apiConfirmPasswordReset(token!, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TOKEN_INVALID') {
          setExpired(true);
        } else if (err.code === 'VALIDATION_ERROR') {
          const field = err.fieldErrors().find((d) => d.field === 'newPassword');
          setPasswordError(field?.message ?? err.message);
        } else if (err.code === 'WEAK_PASSWORD') {
          setPasswordError(err.message);
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

  if (!token || expired) {
    return (
      <AuthShell subtitle="Link no longer valid">
        <p className="text-[13px] leading-6 text-ink text-center">
          This reset link has expired or has already been used. Request a new one to continue.
        </p>
        <p className="mt-6 text-center">
          <AuthLink to="/forgot-password">Request a new link</AuthLink>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell subtitle="Password updated">
        {/* Confirming a reset deletes every session for the account, so there is
            nothing to resume - the user signs in fresh with the new password. */}
        <p className="text-[13px] leading-6 text-ink text-center">
          Your password has been updated. You've been signed out everywhere else.
        </p>
        <p className="mt-6 text-center">
          <AuthLink to="/login">Sign in</AuthLink>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Choose a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
          aria-label="New password"
          error={Boolean(passwordError)}
          errorText={passwordError}
        />

        {formError && <AuthFormError>{formError}</AuthFormError>}

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? '…' : 'Set new password'}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthShell>
  );
}
