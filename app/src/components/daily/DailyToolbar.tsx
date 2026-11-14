import { ArrowUpDown } from 'lucide-react';
import type { useDailyView } from '../../hooks/useDailyView';
import { useFullWidth } from '../../hooks/useFullWidth';
import { useI18n } from '../../i18n/I18nContext';
import { DAILY_LAYOUTS } from '../../utils/dailyRange';
import type { WeekStart } from '../../utils/date';
import { DateNav } from '../toolbar/DateNav';
import { MenuItem, MenuSection } from '../toolbar/MenuButton';
import { PageToolbar } from '../toolbar/PageToolbar';
import { ViewMenu } from '../toolbar/ViewMenu';

interface DailyToolbarProps {
  view: ReturnType<typeof useDailyView>;
  todayKey: string;
  weekStart: WeekStart;
  /** Reorganize is offered only when there is something to move. */
  onReorganize?: () => void;
  onToday: () => void;
}

export function DailyToolbar({ view, todayKey, weekStart, onReorganize, onToday }: DailyToolbarProps) {
  const { t } = useI18n();
  const { fullWidth, setFullWidth } = useFullWidth();

  return (
    <PageToolbar
      fullWidth={fullWidth}
      onFullWidthChange={setFullWidth}
      nav={(density) => (
        <DateNav
          from={view.from}
          to={view.to}
          today={todayKey}
          weekStart={weekStart}
          onPrevious={view.previous}
          onNext={view.next}
          onToday={onToday}
          onPick={view.pick}
          compact={density >= 1}
          hideToday={density >= 2}
        />
      )}
      view={({ sheet, windowItems }) => (
        <ViewMenu
          sheet={sheet}
          layouts={DAILY_LAYOUTS}
          layout={view.layout}
          onLayoutChange={view.setLayout}
          style={view.style}
          onStyleChange={view.setStyle}
          range={view.range}
          onRangeChange={view.setRange}
          extra={(close) => (
            <>
              {onReorganize && (
                <MenuSection label={t('view.actions')}>
                  <MenuItem
                    label={t('reorganize.button')}
                    icon={<ArrowUpDown size={14} strokeWidth={1.6} />}
                    onSelect={() => {
                      onReorganize();
                      close();
                    }}
                  />
                </MenuSection>
              )}
              {windowItems?.(close)}
            </>
          )}
        />
      )}
    />
  );
}
