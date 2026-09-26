import type { BoardGroupBy } from '../../api/client';
import type { BoardViewMode } from '../../types/board';
import { useI18n } from '../../i18n/I18nContext';
import { TaskVisibilityControls } from '../TaskVisibilityControls';
import { GroupBySelect } from '../ui/GroupBySelect';
import { ToolbarSectionLabel } from '../ui/Toolbar';

interface BoardToolbarProps {
  view: BoardViewMode;
  groupBy: BoardGroupBy;
  hideCompletedTasks: boolean;
  showNotes: boolean;
  preferencesDisabled: boolean;
  onGroupByChange: (groupBy: BoardGroupBy) => void;
  onHideCompletedTasksChange: (value: boolean) => void;
  onShowNotesChange: (value: boolean) => void;
}

export function BoardToolbar(props: BoardToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="board-page-toolbar">
      <div className="board-toolbar-primary-controls">
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
