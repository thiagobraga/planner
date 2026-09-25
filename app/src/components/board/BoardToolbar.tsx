import type { BoardGroupBy } from '../../api/client';
import type { BoardViewMode } from '../../types/board';
import { useI18n } from '../../i18n/I18nContext';
import { TaskVisibilityControls } from '../TaskVisibilityControls';
import { GroupBySelect } from '../ui/GroupBySelect';
import { ViewToolbar } from '../ui/ViewToolbar';
import { ToolbarSectionLabel } from '../ui/Toolbar';

interface BoardToolbarProps {
  view: BoardViewMode;
  groupBy: BoardGroupBy;
  hideCompletedTasks: boolean;
  showNotes: boolean;
  preferencesDisabled: boolean;
  onViewChange: (view: BoardViewMode) => void;
  onGroupByChange: (groupBy: BoardGroupBy) => void;
  onHideCompletedTasksChange: (value: boolean) => void;
  onShowNotesChange: (value: boolean) => void;
  onCalendarClick?: () => void;
  showCalendar?: boolean;
}

export function BoardToolbar(props: BoardToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="board-page-toolbar">
      <div className="board-toolbar-primary-controls">
        <ToolbarSectionLabel>{t('menu.view')}</ToolbarSectionLabel>
        <ViewToolbar
          view={props.view}
          onViewChange={props.onViewChange}
          onCalendarClick={props.onCalendarClick}
          viewOnly
          compact
          showCalendar={props.showCalendar}
        />
        {(props.view === 'kanban-list' || props.view === 'kanban') && (
          <div className="board-toolbar-kanban-controls">
            <span className="board-toolbar-group-label">{t('board.groupBy')}</span>
            <GroupBySelect value={props.groupBy} onChange={props.onGroupByChange} />
          </div>
        )}
        <ToolbarSectionLabel>{t('menu.show')}</ToolbarSectionLabel>
        <TaskVisibilityControls
          hideCompletedTasks={props.hideCompletedTasks}
          showNotes={props.showNotes}
          disabled={props.preferencesDisabled}
          onHideCompletedTasksChange={props.onHideCompletedTasksChange}
          onShowNotesChange={props.onShowNotesChange}
        />
      </div>
    </div>
  );
}
