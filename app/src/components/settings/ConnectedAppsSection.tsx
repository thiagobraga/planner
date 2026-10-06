import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppWindow } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ConfirmModal';
import { apiDisconnectApp, fetchConnectedApps } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { ConnectedApp } from '../../types/oauth';

const CONNECTED_APPS_KEY = ['connected-apps'] as const;
const labelClass = 'text-[10px] leading-6 tracking-[0.12em] uppercase text-ink-light font-medium';

/** Apps signed in through OAuth (claude.ai, ChatGPT...). Hidden until there is one. */
export function ConnectedAppsSection() {
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const [pending, setPending] = useState<ConnectedApp | null>(null);
  const { data: apps = [] } = useQuery({ queryKey: CONNECTED_APPS_KEY, queryFn: fetchConnectedApps });

  const disconnect = useMutation({
    mutationFn: (id: string) => apiDisconnectApp(id),
    onSettled: () => qc.invalidateQueries({ queryKey: CONNECTED_APPS_KEY }),
  });

  if (apps.length === 0) return null;

  const date = (iso: string) => formatDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section className="space-y-3" aria-labelledby="connected-apps-heading">
      <div>
        <h3 id="connected-apps-heading" className={labelClass}>
          {t('settings.connectedApps.title')}
        </h3>
        <p className="m-0 text-[13px] leading-6 text-ink-light">{t('settings.connectedApps.description')}</p>
      </div>
      <ul className="m-0 list-none divide-y divide-[var(--planner-settings-separator)] p-0" aria-label={t('settings.connectedApps.title')}>
        {apps.map((app) => (
          <li key={app.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-2 text-sm leading-6 font-medium text-ink">
                <AppWindow size={14} strokeWidth={1.5} className="shrink-0 text-ink-light" />
                <span className="truncate">{app.clientName}</span>
              </p>
              <p className="m-0 text-[12px] leading-6 text-ink-light">
                {[
                  app.scopes.includes('write') ? t('settings.apiTokens.readWrite') : t('settings.apiTokens.readOnly'),
                  t('settings.connectedApps.connectedOn', { date: date(app.createdAt) }),
                  app.lastUsedAt ? t('settings.apiTokens.lastUsed', { date: date(app.lastUsedAt) }) : t('settings.apiTokens.neverUsed'),
                ].join(' · ')}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setPending(app)}>
              {t('settings.connectedApps.disconnect')}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={pending !== null}
        title={t('settings.connectedApps.disconnectTitle')}
        message={t('settings.connectedApps.disconnectMessage', { name: pending?.clientName ?? '' })}
        confirmLabel={t('settings.connectedApps.disconnect')}
        onConfirm={() => {
          if (pending) disconnect.mutate(pending.id);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
