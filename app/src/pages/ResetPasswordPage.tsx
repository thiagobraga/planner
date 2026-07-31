import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AuthShell, AuthLink, AuthFormError } from '../components/AuthShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiError, apiConfirmPasswordReset } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { Eye, EyeOff } from 'lucide-react';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setFormError(err instanceof Error ? err.message : t('auth.somethingWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token || expired) {
    return (
      <AuthShell subtitle={t('auth.linkInvalid')}>
        <p className="text-[13px] leading-6 text-ink text-center">
          {t('auth.linkInvalidMessage')}
        </p>
        <p className="mt-6 text-center">
          <AuthLink to="/forgot-password">{t('auth.requestNewLink')}</AuthLink>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell subtitle={t('auth.passwordUpdated')}>
        {/* Confirming a reset deletes every session for the account, so there is
            nothing to resume - the user signs in fresh with the new password. */}
        <p className="text-[13px] leading-6 text-ink text-center">
          {t('auth.passwordUpdatedMessage')}
        </p>
        <p className="mt-6 text-center">
          <AuthLink to="/login">{t('auth.signIn')}</AuthLink>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle={t('auth.chooseNewPassword')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder={t('auth.newPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
          aria-label={t('auth.newPassword')}
          error={Boolean(passwordError)}
          errorText={passwordError}
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

        {formError && <AuthFormError>{formError}</AuthFormError>}

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? '…' : t('auth.setNewPassword')}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <AuthLink to="/login">{t('auth.backToSignIn')}</AuthLink>
      </p>
    </AuthShell>
  );
}
