import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import {
  apiListUsers,
  apiDisableUser,
  apiEnableUser,
  apiRevokeSessions,
  type AdminUser,
} from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nContext';

const SEARCH_DEBOUNCE_MS = 300;

type PendingAction = { kind: 'disable' | 'revoke'; user: AdminUser };

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function UserRow({
  user,
  onDisable,
  onEnable,
  onRevoke,
  busy,
  isSelf,
}: {
  user: AdminUser;
  onDisable: (user: AdminUser) => void;
  onEnable: (user: AdminUser) => void;
  onRevoke: (user: AdminUser) => void;
  busy: boolean;
  /** The signed-in admin: the server refuses to let them disable themselves. */
  isSelf: boolean;
}) {
  const { t, formatDate } = useI18n();
  const isDisabled = user.disabledAt !== null;

  return (
    <div className="admin-users-row grid items-center gap-3 border-b border-dot py-3 md:grid-cols-[minmax(0,2fr)_100px_96px_128px_1fr] grid-cols-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm leading-6 text-ink">{user.email}</span>
          {user.role === 'admin' && (
            <span
              className="inline-flex items-center gap-1 shrink-0 rounded-[8px] bg-dot px-2 text-[11px] leading-6 text-ink"
              title={t('admin.roleAdmin')}
            >
              <ShieldCheck size={12} strokeWidth={1.5} />
              {t('admin.roleAdmin')}
            </span>
          )}
        </div>
        {user.displayName && (
          <span className="block truncate text-[13px] leading-6 text-ink-light opacity-60">
            {user.displayName}
          </span>
        )}
      </div>

      <span className="text-[13px] leading-6 text-ink-light">
        {formatDate(new Date(user.createdAt), { dateStyle: 'medium' })}
      </span>

      <span
        className={`inline-flex w-fit items-center rounded-[8px] px-2 text-[11px] leading-6 ${
          isDisabled ? 'bg-accent/12 text-accent' : 'bg-moss/20 text-moss'
        }`}
      >
        {isDisabled ? t('admin.statusDisabled') : t('admin.statusActive')}
      </span>

      <span className="text-[13px] leading-6 text-ink-light">
        {user.lastSeenAt
          ? formatDate(new Date(user.lastSeenAt), { dateStyle: 'short', timeStyle: 'short' })
          : t('admin.never')}
        <span className="opacity-60"> · {user.activeSessions}</span>
      </span>

      <div className="flex items-center gap-2 md:justify-end">
        {isDisabled ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onEnable(user)}>
            {t('admin.enable')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || isSelf}
            title={isSelf ? t('admin.cannotDisableSelf') : undefined}
            onClick={() => onDisable(user)}
          >
            {t('admin.disable')}
          </Button>
        )}
        <Button
          size="sm"
          variant="tertiary"
          disabled={busy || user.activeSessions === 0}
          onClick={() => onRevoke(user)}
        >
          {t('admin.revokeSessions')}
        </Button>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState(false);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const usersQuery = useInfiniteQuery({
    queryKey: ['admin', 'users', debouncedSearch],
    queryFn: ({ pageParam }) =>
      apiListUsers({ search: debouncedSearch || undefined, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data],
  );

  const runAction = useMutation({
    mutationFn: ({ kind, user }: { kind: 'disable' | 'enable' | 'revoke'; user: AdminUser }) => {
      if (kind === 'disable') return apiDisableUser(user.id);
      if (kind === 'enable') return apiEnableUser(user.id);
      return apiRevokeSessions(user.id);
    },
    onSuccess: () => {
      setActionError(false);
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: () => setActionError(true),
  });

  const confirmPending = () => {
    if (!pending) return;
    runAction.mutate({ kind: pending.kind === 'disable' ? 'disable' : 'revoke', user: pending.user });
    setPending(null);
  };

  return (
    <div className="admin-users-page w-full max-w-4xl">
      <header className="page-header-copy sticky-page-header max-w-162">
        <div className="page-header-copy-text">
          <h1 className="m-0 h-6 p-0 text-lg leading-6 font-semibold text-ink">{t('admin.usersTitle')}</h1>
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
            {t('admin.usersSubtitle')}
          </p>
        </div>
      </header>

      <div className="h-6" />

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin.searchPlaceholder')}
        aria-label={t('admin.searchUsers')}
        icon={<Search strokeWidth={1.5} />}
      />

      <div className="h-6" />

      {usersQuery.isError && (
        <p className="text-sm leading-6 text-accent">{t('admin.loadFailed')}</p>
      )}

      {actionError && <p className="text-sm leading-6 text-accent">{t('admin.actionFailed')}</p>}

      {usersQuery.isPending ? (
        <p className="text-sm leading-6 text-ink-light opacity-60">{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm italic text-ink-light opacity-60">
          {t('admin.noUsers')}
        </p>
      ) : (
        <div className="flex flex-col">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_100px_96px_128px_1fr] gap-3 border-b border-dot pb-3 text-[11px] uppercase tracking-wide text-ink-light opacity-60">
            <span>{t('admin.colUser')}</span>
            <span>{t('admin.colJoined')}</span>
            <span>{t('admin.colStatus')}</span>
            <span>{t('admin.colLastSeen')}</span>
            <span className="text-right">{t('admin.colSessions')}</span>
          </div>

          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              busy={runAction.isPending}
              isSelf={user.id === currentUser?.id}
              onDisable={(target) => setPending({ kind: 'disable', user: target })}
              onRevoke={(target) => setPending({ kind: 'revoke', user: target })}
              onEnable={(target) => runAction.mutate({ kind: 'enable', user: target })}
            />
          ))}
        </div>
      )}

      {usersQuery.hasNextPage && (
        <div className="pt-6">
          <Button
            size="md"
            variant="secondary"
            disabled={usersQuery.isFetchingNextPage}
            onClick={() => usersQuery.fetchNextPage()}
          >
            {t('admin.loadMore')}
          </Button>
        </div>
      )}

      <ConfirmModal
        isOpen={pending !== null}
        title={pending?.kind === 'revoke' ? t('admin.revokeTitle') : t('admin.disableTitle')}
        message={
          pending
            ? pending.kind === 'revoke'
              ? t('admin.revokeMessage', { email: pending.user.email })
              : t('admin.disableMessage', { email: pending.user.email })
            : ''
        }
        confirmLabel={pending?.kind === 'revoke' ? t('admin.revokeSessions') : t('admin.disable')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
