import type { BoardGroupBy, BoardViewMode } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { TaskVisibilityControls } from '../TaskVisibilityControls';
import { GroupBySelect } from '../ui/GroupBySelect';
import { ViewToolbar } from '../ui/ViewToolbar';

interface BoardToolbarProps {
  view: BoardViewMode;
  groupBy: BoardGroupBy;
  hideCompletedTasks: boolean;
  hideOldNotes: boolean;
  preferencesDisabled: boolean;
  onViewChange: (view: BoardViewMode) => void;
  onGroupByChange: (groupBy: BoardGroupBy) => void;
  onHideCompletedTasksChange: (value: boolean) => void;
  onHideOldNotesChange: (value: boolean) => void;
}

export function BoardToolbar(props: BoardToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="board-page-toolbar">
      <div className="board-toolbar-primary-controls">
        <ViewToolbar
          view={props.view}
          onViewChange={props.onViewChange}
          viewOnly
          compact
        />
        {props.view === 'kanban' && (
          <div className="board-toolbar-kanban-controls">
            <span className="board-toolbar-group-label">{t('board.groupBy')}</span>
            <GroupBySelect value={props.groupBy} onChange={props.onGroupByChange} />
          </div>
        )}
        <TaskVisibilityControls
          hideCompletedTasks={props.hideCompletedTasks}
          hideOldNotes={props.hideOldNotes}
          disabled={props.preferencesDisabled}
          onHideCompletedTasksChange={props.onHideCompletedTasksChange}
          onHideOldNotesChange={props.onHideOldNotesChange}
        />
      </div>
    </div>
  );
}
