import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCollectionView } from '../api/client';
import { ApiError } from '../api/transport';
import { useSync } from './useSync';

export function isCollectionUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

/** `ready` holds the fetch until the inputs are known, so one load is one request. */
export function useCollectionView(id: string, includeCompleted: boolean, ready = true) {
  const qc = useQueryClient();
  const viewKey = useMemo(
    () => (includeCompleted ? ['collection', id, 'with-completed'] : ['collection', id]),
    [id, includeCompleted],
  );
  const query = useQuery({
    queryKey: viewKey,
    queryFn: () => fetchCollectionView(id, { includeCompleted }),
    staleTime: 30_000,
    enabled: !!id && ready,
    retry: (count, error) => !isCollectionUnavailable(error) && count < 1,
  });

  useSync(useCallback((event) => {
    const movedFromThisView = event.entityType === 'task'
      && query.data?.tasks.some((task) => task.id === event.entityId);
    if ((event.entityType === 'task' || event.entityType === 'section')
      && (event.collectionId === id || movedFromThisView)) {
      void qc.invalidateQueries({ queryKey: ['collection', id] });
    }
  }, [id, qc, query.data]));

  return { data: query.data, error: query.error, isError: query.isError, refetch: query.refetch, viewKey };
}
