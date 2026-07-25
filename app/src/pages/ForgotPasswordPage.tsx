import { useState } from 'react';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError, apiRequestPasswordReset } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useI18n } from '../i18n/I18nContext';

export function ForgotPasswordPage() {
  const { t } = useI18n();
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
      <AuthShell subtitle={t('auth.checkInbox')}>
        <p className="text-[13px] leading-6 text-ink text-center">
          {t('auth.checkInboxMessage')}
        </p>
        <p className="mt-6 text-center">
          <AuthLink to="/login">{t('auth.backToSignIn')}</AuthLink>
        </p>
      </AuthShell>
    );
  }

  const throttled = secondsLeft > 0;

  return (
    <AuthShell subtitle={t('auth.resetPassword')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-[13px] leading-6 text-ink-light">
          {t('auth.resetIntro')}
        </p>
        <Input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          aria-label={t('auth.email')}
        />

        {formError && (
          <AuthFormError>
            {throttled ? `${formError} ${t('auth.retryIn', { time: formatCountdown(secondsLeft) })}` : formError}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : t('auth.sendResetLink')}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">{t('auth.backToSignIn')}</AuthLink>
      </p>
    </AuthShell>
  );
}
