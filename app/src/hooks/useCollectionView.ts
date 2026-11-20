import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionView } from '../api/client';
import { ApiError } from '../api/transport';
import { useSync } from './useSync';
import { useCoalescedInvalidate } from './useCoalescedInvalidate';

export function isCollectionUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

export function useCollectionView(id: string, includeCompleted: boolean) {
  const viewKey = useMemo(
    () => (includeCompleted ? ['collection', id, 'with-completed'] : ['collection', id]),
    [id, includeCompleted],
  );
  const query = useQuery({
    queryKey: viewKey,
    queryFn: () => fetchCollectionView(id, { includeCompleted }),
    staleTime: 30_000,
    enabled: !!id,
    retry: (count, error) => !isCollectionUnavailable(error) && count < 1,
  });

  const refreshSoon = useCoalescedInvalidate(['collection', id]);

  useSync(useCallback((event) => {
    const movedFromThisView = event.entityType === 'task'
      && query.data?.tasks.some((task) => task.id === event.entityId);
    if ((event.entityType === 'task' || event.entityType === 'section')
      && (event.collectionId === id || movedFromThisView)) {
      refreshSoon();
    }
  }, [id, query.data, refreshSoon]));

  return { data: query.data, error: query.error, isError: query.isError, refetch: query.refetch, viewKey };
}
