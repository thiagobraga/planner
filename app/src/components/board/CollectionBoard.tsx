import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiSeedStatuses,
  type ApiSection,
  type ApiStatus,
  type ApiTask,
  type BoardGroupBy,
  type BoardOrder,
} from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { buildColumns } from '../../utils/boardColumns';
import { BoardView } from './BoardView';

interface CollectionBoardProps {
  collectionId: string;
  queryKey: readonly unknown[];
  groupBy: BoardGroupBy;
  tasks: ApiTask[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  sections: ApiSection[];
  boardOrder: BoardOrder;
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function CollectionBoard(props: CollectionBoardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const seedRequested = useRef(false);

  useEffect(() => {
    if (props.groupBy !== 'status' || seedRequested.current) return;
    seedRequested.current = true;
    apiSeedStatuses(props.collectionId)
      .then(() => queryClient.invalidateQueries({ queryKey: props.queryKey }))
      .catch(() => {
        seedRequested.current = false;
      });
  }, [props.collectionId, props.groupBy, props.queryKey, props.statuses.length, queryClient]);

  const columns = useMemo(() => buildColumns({
    groupBy: props.groupBy,
    tasks: props.tasks,
    statuses: props.statuses,
    completionStatusId: props.completionStatusId,
    sections: props.sections,
    boardOrder: props.boardOrder,
    noSectionTitle: t('board.noSection'),
    priorityTitle: (priority) => t('board.priority', { priority }),
  }), [props.boardOrder, props.completionStatusId, props.groupBy, props.sections, props.statuses, props.tasks, t]);

  if (props.groupBy === 'status' && props.statuses.length === 0) {
    return <div className="board-loading">{t('board.preparing')}</div>;
  }

  return (
    <BoardView
      columns={columns}
      tasks={props.tasks}
      canAddColumn={props.groupBy === 'status'}
      onToggle={props.onToggle}
    />
  );
}
