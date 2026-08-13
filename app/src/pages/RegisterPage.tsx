import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError } from '../api/client';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useI18n } from '../i18n/I18nContext';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      await register(email, password);
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
          type={showPassword ? 'text' : 'password'}
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          aria-label={t('auth.password')}
          error={Boolean(fieldErrors.password)}
          errorText={fieldErrors.password}
          trailing={(
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border-0 bg-transparent text-ink-light hover:text-ink"
              aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              title={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        />
        <PasswordRequirements password={password} />

        {formError && (
          <AuthFormError>
            {throttled ? `${formError} ${t('auth.retryIn', { time: formatCountdown(secondsLeft) })}` : formError}
          </AuthFormError>
        )}

        <Button type="submit" variant="primary" className="mt-3" disabled={loading || throttled}>
          {loading ? '…' : t('auth.createAccountButton')}
        </Button>
      </form>

      <p className="mt-2 text-center">
        <AuthLink to="/login">{t('auth.signInExisting')}</AuthLink>
      </p>
    </AuthShell>
  );
}
