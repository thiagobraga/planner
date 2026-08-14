import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import {
  apiGetAdminCounts,
  apiGetAdminHealth,
  apiGetAdminAuthStats,
} from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n/I18nContext';

// Dashboard numbers move faster than the app-wide 60s default.
const STALE_TIME_MS = 30_000;

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pb-6">
      <h2 className="text-sm leading-6 font-semibold text-ink h-6">{title}</h2>
      <div className="h-6" />
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-tile border border-dot rounded-[8px] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide leading-6 text-ink-light opacity-60">
        {label}
      </div>
      <div className="text-lg leading-6 text-ink">{value}</div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: 'up' | 'down' }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between border-b border-dot py-3">
      <span className="text-sm leading-6 text-ink-light">{label}</span>
      <span
        className={`inline-flex items-center rounded-[8px] px-2 text-[11px] leading-6 ${
          status === 'up' ? 'bg-moss/20 text-moss' : 'bg-accent/12 text-accent'
        }`}
      >
        {status === 'up' ? t('admin.statusUp') : t('admin.statusDown')}
      </span>
    </div>
  );
}

export function AdminDashboardPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const counts = useQuery({
    queryKey: ['admin', 'stats', 'counts'],
    queryFn: apiGetAdminCounts,
    staleTime: STALE_TIME_MS,
  });
  const health = useQuery({
    queryKey: ['admin', 'stats', 'health'],
    queryFn: apiGetAdminHealth,
    staleTime: STALE_TIME_MS,
  });
  const authStats = useQuery({
    queryKey: ['admin', 'stats', 'auth'],
    queryFn: apiGetAdminAuthStats,
    staleTime: STALE_TIME_MS,
  });

  const isLoading = counts.isPending || health.isPending || authStats.isPending;
  const isError = counts.isError || health.isError || authStats.isError;

  return (
    <div className="admin-dashboard-page w-full max-w-4xl">
      <header className="page-header-copy sticky-page-header max-w-162">
        <div className="page-header-copy-text">
          <h1 className="m-0 h-6 p-0 text-lg leading-6 font-semibold text-ink">
            {t('admin.dashboardTitle')}
          </h1>
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
            {t('admin.dashboardSubtitle')}
          </p>
        </div>
        <div className="page-header-toolbar">
          <Button
            size="xs"
            variant="tertiary"
            leftIcon={<RefreshCw strokeWidth={1.5} />}
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'stats'] })}
          >
            {t('admin.refresh')}
          </Button>
        </div>
      </header>

      <div className="h-6" />

      {isError && <p className="text-sm leading-6 text-accent">{t('admin.loadFailed')}</p>}
      {isLoading && (
        <p className="text-sm leading-6 text-ink-light opacity-60">{t('common.loading')}</p>
      )}

      {counts.data && (
        <Section title={t('admin.sectionCounts')}>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Tile label={t('admin.countUsers')} value={counts.data.users} />
            <Tile label={t('admin.countActiveUsers')} value={counts.data.activeUsers} />
            <Tile label={t('admin.countDisabledUsers')} value={counts.data.disabledUsers} />
            <Tile label={t('admin.countAdmins')} value={counts.data.admins} />
            <Tile label={t('admin.countTasks')} value={counts.data.tasks} />
            <Tile label={t('admin.countCompletedTasks')} value={counts.data.completedTasks} />
            <Tile label={t('admin.countCollections')} value={counts.data.collections} />
            <Tile label={t('admin.countHabits')} value={counts.data.habits} />
          </div>
        </Section>
      )}

      {health.data && (
        <Section title={t('admin.sectionHealth')}>
          <StatusRow label={t('admin.database')} status={health.data.database.status} />
          <StatusRow label={t('admin.redis')} status={health.data.redis.status} />
          <div className="h-6" />
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            <Tile
              label={t('admin.poolConnections')}
              value={health.data.database.totalConnections}
            />
            <Tile label={t('admin.poolIdle')} value={health.data.database.idleConnections} />
            <Tile label={t('admin.poolWaiting')} value={health.data.database.waitingRequests} />
            <Tile
              label={t('admin.uptime')}
              value={formatUptime(health.data.process.uptimeSeconds)}
            />
            <Tile
              label={t('admin.memory')}
              value={formatBytes(health.data.process.memoryRssBytes)}
            />
            <Tile label={t('admin.nodeVersion')} value={health.data.process.nodeVersion} />
          </div>
        </Section>
      )}

      {authStats.data && (
        <Section title={t('admin.sectionAuth')}>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            <Tile label={t('admin.activeSessions')} value={authStats.data.activeSessions} />
            <Tile label={t('admin.sessionsLastDay')} value={authStats.data.sessionsLastDay} />
            <Tile
              label={t('admin.usersOnlineLastHour')}
              value={authStats.data.usersOnlineLastHour}
            />
            <Tile label={t('admin.throttledAccounts')} value={authStats.data.throttledAccounts} />
            <Tile label={t('admin.throttledIps')} value={authStats.data.throttledIps} />
            <Tile
              label={t('admin.failedLoginAttempts')}
              value={authStats.data.failedLoginAttempts}
            />
          </div>
          <div className="h-6" />
          <p className="text-[13px] leading-6 text-ink-light opacity-60">
            {t('admin.rateLimitNote')}
          </p>
        </Section>
      )}
    </div>
  );
}
