import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useI18n } from '../i18n/I18nContext';

export function LoginPage() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t('auth.somethingWrong'));
      setLoading(false);
    }
  };

  const throttled = secondsLeft > 0;

  return (
    <AuthShell>
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
        />
        <Input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          aria-label={t('auth.password')}
        />

        {error && (
          <AuthFormError>
            {throttled ? `${error} ${t('auth.retryIn', { time: formatCountdown(secondsLeft) })}` : error}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" disabled={loading || throttled}>
          {loading ? '…' : t('auth.signIn')}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1">
        <AuthLink to="/forgot-password">{t('auth.forgotPassword')}</AuthLink>
        <AuthLink to="/register">{t('auth.noAccount')}</AuthLink>
      </div>
    </AuthShell>
  );
}
