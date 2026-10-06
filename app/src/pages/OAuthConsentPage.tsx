import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { AuthShell, AuthFormError } from '../components/AuthShell';
import { Button } from '../components/ui/Button';
import { apiDecideOAuthRequest, fetchOAuthRequest } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type { ConsentDecision } from '../types/oauth';

/** Where an MCP client's sign-in lands: the user decides what that app may do. */
export function OAuthConsentPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request') ?? '';
  const [leaving, setLeaving] = useState(false);

  const { data: pending, isLoading, isError } = useQuery({
    queryKey: ['oauth-request', requestId],
    queryFn: () => fetchOAuthRequest(requestId),
    enabled: requestId !== '',
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (decision: ConsentDecision) => apiDecideOAuthRequest(requestId, decision),
    onSuccess: ({ redirectUrl }) => {
      setLeaving(true);
      window.location.assign(redirectUrl);
    },
  });

  if (isLoading) {
    return (
      <AuthShell subtitle={t('oauth.subtitle')}>
        <p className="m-0 text-center text-[13px] leading-6 text-ink-light">{t('common.loading')}</p>
      </AuthShell>
    );
  }

  if (!pending || isError) {
    return (
      <AuthShell subtitle={t('oauth.subtitle')}>
        <AuthFormError>{t('oauth.expired')}</AuthFormError>
      </AuthShell>
    );
  }

  const canWrite = pending.scopes.includes('write');
  const busy = decide.isPending || leaving;

  return (
    <AuthShell title={t('oauth.title', { app: pending.clientName })} subtitle={t('oauth.subtitle')}>
      <section aria-label={t('oauth.permissions')} className="flex flex-col gap-6">
        <p className="m-0 text-center text-[13px] leading-6 text-ink-light">
          {t('oauth.returnsTo', { host: pending.redirectHost })}
        </p>
        <ul className="m-0 list-disc space-y-0 pl-6 text-[13px] leading-6 text-ink">
          <li>{t('oauth.canRead')}</li>
          {canWrite && <li>{t('oauth.canWrite')}</li>}
        </ul>

        {decide.isError && <AuthFormError>{t('oauth.expired')}</AuthFormError>}

        <div className="flex flex-col gap-3">
          <Button variant="primary" disabled={busy} onClick={() => decide.mutate(canWrite ? 'write' : 'read')}>
            {canWrite ? t('oauth.allowWrite') : t('oauth.allowRead')}
          </Button>
          {canWrite && (
            <Button variant="secondary" disabled={busy} onClick={() => decide.mutate('read')}>
              {t('oauth.allowRead')}
            </Button>
          )}
          <Button variant="tertiary" disabled={busy} onClick={() => decide.mutate('deny')}>
            {t('common.cancel')}
          </Button>
        </div>
      </section>
    </AuthShell>
  );
}
