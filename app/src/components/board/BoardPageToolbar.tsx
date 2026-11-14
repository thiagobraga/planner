import { CircleDot, Flag, FolderOpen } from 'lucide-react';
import type { useBoardPreferences } from '../../hooks/useBoardPreferences';
import { BOARD_LAYOUTS } from '../../hooks/useBoardPreferences';
import { useFullWidth } from '../../hooks/useFullWidth';
import { usePageShortcuts } from '../../hooks/usePageShortcuts';
import type { ViewLayout } from '../../types/view';
import { useI18n } from '../../i18n/I18nContext';
import type { GroupByOption } from '../../types/toolbar';
import type { BoardGroupBy } from '../../types/drag';
import { GroupByMenu } from '../toolbar/GroupByMenu';
import { PageToolbar } from '../toolbar/PageToolbar';
import { ViewMenu } from '../toolbar/ViewMenu';

/** Toolbar for pages without dates (Collections, Inbox): grouping where navigation would be, then View and Window. */
export function BoardPageToolbar({ board }: { board: ReturnType<typeof useBoardPreferences> }) {
  const { t } = useI18n();
  const { fullWidth, setFullWidth } = useFullWidth();

  usePageShortcuts((action) => {
    const [, kind, value] = action.split(':');
    if (kind === 'layout' && BOARD_LAYOUTS.includes(value as ViewLayout)) board.setLayout(value as ViewLayout);
    else if (kind === 'style') board.toggleStyle();
  });
  const options: GroupByOption<BoardGroupBy>[] = [
    { value: 'status', label: t('board.group.status'), icon: <CircleDot size={14} strokeWidth={1.6} /> },
    { value: 'section', label: t('board.group.section'), icon: <FolderOpen size={14} strokeWidth={1.6} /> },
    { value: 'priority', label: t('board.group.priority'), icon: <Flag size={14} strokeWidth={1.6} /> },
  ];

  return (
    <PageToolbar
      fullWidth={fullWidth}
      onFullWidthChange={setFullWidth}
      // Grouping only shapes the columns today; List keeps its sections.
      nav={board.layout === 'columns'
        ? (_density, mobile) => <GroupByMenu value={board.groupBy} options={options} onChange={board.setGroupBy} sheet={mobile} />
        : undefined}
      view={({ sheet, windowItems }) => (
        <ViewMenu
          sheet={sheet}
          layouts={BOARD_LAYOUTS}
          layout={board.layout}
          onLayoutChange={board.setLayout}
          style={board.style}
          onStyleChange={board.setStyle}
          extra={windowItems}
        />
      )}
    />
  );
}
