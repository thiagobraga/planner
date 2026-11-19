import { ArrowUpDown } from 'lucide-react';
import { usePageShortcuts } from '../../hooks/usePageShortcuts';
import type { ViewLayout } from '../../types/view';
import { useI18n } from '../../i18n/I18nContext';
import { DAILY_LAYOUTS } from '../../utils/dailyRange';
import { Button } from '../ui/Button';
import { DateNav } from '../toolbar/DateNav';
import { MenuItem, MenuSection } from '../toolbar/MenuButton';
import { PageToolbar } from '../toolbar/PageToolbar';
import { ViewMenu } from '../toolbar/ViewMenu';
import type { DailyToolbarProps } from '../../types/daily';

export function DailyToolbar({ view, todayKey, weekStart, onReorganize, onToday }: DailyToolbarProps) {
  const { t } = useI18n();

  usePageShortcuts((action) => {
    const [, kind, value] = action.split(':');
    if (kind === 'layout' && DAILY_LAYOUTS.includes(value as ViewLayout)) view.setLayout(value as ViewLayout);
    else if (kind === 'style') view.toggleStyle();
    else if (kind === 'range') view.setRangeByShortcut(value);
    else if (kind === 'today') onToday();
    else if (kind === 'previous') view.previous();
    else if (kind === 'next') view.next();
  });

  return (
    <PageToolbar
      nav={(density, mobile) => (
        <DateNav
          openUp={mobile}
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
      view={({ sheet }) => (
        <div className="flex items-center gap-1">
        {sheet && onReorganize && (
          <Button variant="secondary" size="xs" className="!gap-1" onClick={onReorganize}>
            <ArrowUpDown size={12} strokeWidth={1.8} aria-hidden="true" />
            {t('reorganize.button')}
          </Button>
        )}
        <ViewMenu
          sheet={sheet}
          layouts={DAILY_LAYOUTS}
          layout={view.layout}
          onLayoutChange={view.setLayout}
          style={view.style}
          onStyleChange={view.setStyle}
          range={view.range}
          onRangeChange={view.setRange}
          extra={onReorganize && !sheet && ((close) => (
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
          ))}
        />
        </div>
      )}
    />
  );
}
