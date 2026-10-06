import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { fetchActivity } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/catalogs';
import type { ActivityEntry, ActivityQuery } from '../../types/activity';

const VERBS: Record<string, TranslationKey> = {
  task_created: 'activity.created',
  task_updated: 'activity.updated',
  task_completed: 'activity.completed',
  task_reopened: 'activity.reopened',
  task_deleted: 'activity.deleted',
};

function ActivityRow({ entry, showActor }: { entry: ActivityEntry; showActor: boolean }) {
  const { t, formatDate } = useI18n();
  const verb = VERBS[entry.eventType] ? t(VERBS[entry.eventType]!) : entry.eventType;
  const when = formatDate(new Date(entry.createdAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <li className="py-2 text-[13px] leading-6 text-ink">
      <span className="font-medium">{verb}</span> {entry.title ? `"${entry.title}"` : t('activity.untitled')}
      <span className="text-ink-light">
        {' · '}
        {when}
        {showActor && entry.actor.label ? ` · ${t('activity.via', { name: entry.actor.label })}` : ''}
      </span>
    </li>
  );
}

/** Activity made with API tokens: one token's, or every token's when no tokenId is given. */
export function TokenActivityList({ query, limit, label }: { query: ActivityQuery; limit?: number; label: string }) {
  const { t } = useI18n();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['activity', query],
    queryFn: ({ pageParam }) => fetchActivity({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (isLoading) return <p className="m-0 text-[13px] leading-6 text-ink-light">{t('common.loading')}</p>;

  const entries = (data?.pages ?? []).flatMap((page) => page.events);
  const shown = limit ? entries.slice(0, limit) : entries;
  if (shown.length === 0) return <p className="m-0 text-[13px] leading-6 text-ink-light">{t('activity.empty')}</p>;

  return (
    <div>
      <ul aria-label={label} className="m-0 list-none divide-y divide-[var(--planner-settings-separator)] p-0">
        {shown.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} showActor={!query.tokenId} />
        ))}
      </ul>
      {!limit && hasNextPage && (
        <Button variant="tertiary" size="sm" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
          {t('activity.loadMore')}
        </Button>
      )}
    </div>
  );
}
