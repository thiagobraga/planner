import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useI18n } from '../i18n/I18nContext';

export function RegisterPage() {
  const { t } = useI18n();
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
        setFormError(err instanceof Error ? err.message : t('auth.somethingWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  const throttled = secondsLeft > 0;

  return (
    <AuthShell subtitle={t('auth.createAccount')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          aria-label={t('auth.email')}
          error={Boolean(fieldErrors.email)}
          errorText={fieldErrors.email}
        />
        <Input
          type="text"
          placeholder={t('auth.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          aria-label={t('auth.displayName')}
          error={Boolean(fieldErrors.displayName)}
          errorText={fieldErrors.displayName}
        />
        <Input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          aria-label={t('auth.password')}
          error={Boolean(fieldErrors.password)}
          errorText={fieldErrors.password}
        />

        {formError && (
          <AuthFormError>
            {throttled ? `${formError} ${t('auth.retryIn', { time: formatCountdown(secondsLeft) })}` : formError}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : t('auth.createAccountButton')}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">{t('auth.signInExisting')}</AuthLink>
      </p>
    </AuthShell>
  );
}
