import { CalendarDays, Columns3, FileText, LayoutList, List, Table } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ViewMenuProps } from '../../types/toolbar';
import type { RangePreset, RangeSpan, ViewLayout, ViewRange, ViewStyle } from '../../types/view';
import { isRangeAvailable, rangeShortcut, rangesFor } from '../../utils/viewRange';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';

const LAYOUT_ICONS: Record<ViewLayout, ReactNode> = {
  list: <List size={14} strokeWidth={1.6} />,
  columns: <Columns3 size={14} strokeWidth={1.6} />,
  table: <Table size={14} strokeWidth={1.6} />,
  calendar: <CalendarDays size={14} strokeWidth={1.6} />,
};

export const LAYOUT_SHORTCUTS: Record<ViewLayout, string> = { list: 'l', columns: 'k', table: 't', calendar: 'c' };

const STYLES: { value: ViewStyle; icon: ReactNode }[] = [
  { value: 'notebook', icon: <FileText size={13} strokeWidth={1.6} /> },
  { value: 'cards', icon: <LayoutList size={13} strokeWidth={1.6} /> },
];

const DAY_SPANS: RangeSpan[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const WEEK_SPANS: RangeSpan[] = ['w1', 'w2', 'w3'];

function keys(key: string | null): string | null {
  return key ? `v ${key}` : null;
}

/** Layout, style and range of a page, in one menu-bar style dropdown. */
export function ViewMenu({ layouts, layout, onLayoutChange, style, onStyleChange, range, onRangeChange, extra, sheet }: ViewMenuProps) {
  const { t } = useI18n();
  const showsPresets = layout === 'list' || layout === 'table';

  const pill = (value: ViewRange, text: string, label: string) => {
    const available = isRangeAvailable(layout, value);
    return (
      <button
        key={value}
        type="button"
        aria-pressed={range === value}
        aria-label={label}
        disabled={!available}
        onClick={() => onRangeChange?.(value)}
        className="page-menu-pill"
      >
        {text}
      </button>
    );
  };

  return (
    <MenuButton label={t('view.menu')} sheet={sheet}>
      {(close) => (
        <>
          <MenuSection label={t('view.layout')}>
            {layouts.map((value) => (
              <MenuItem
                key={value}
                label={t(`view.layout.${value}`)}
                icon={LAYOUT_ICONS[value]}
                shortcut={keys(LAYOUT_SHORTCUTS[value])}
                checked={layout === value}
                onSelect={() => onLayoutChange(value)}
              />
            ))}
          </MenuSection>

          <MenuSection label={t('view.style')}>
            <div className="page-menu-row">
              <div role="radiogroup" aria-label={t('view.style')} className="page-menu-segmented">
                {STYLES.map(({ value, icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={style === value}
                    onClick={() => onStyleChange(value)}
                    className="page-menu-segment"
                  >
                    {icon}
                    {t(`view.style.${value}`)}
                  </button>
                ))}
              </div>
              <kbd className="page-menu-item-shortcut">v s</kbd>
            </div>
          </MenuSection>

          {range && onRangeChange && (
            <MenuSection label={t('view.range')}>
              {showsPresets ? (
                rangesFor(layout).map((value) => (
                  <MenuItem
                    key={value}
                    label={t(`view.range.${value as RangePreset}`)}
                    shortcut={keys(rangeShortcut(value))}
                    checked={range === value}
                    onSelect={() => onRangeChange(value)}
                  />
                ))
              ) : (
                <>
                  <div className="page-menu-pill-row">
                    <span className="page-menu-pill-label">{t('view.range.days')}</span>
                    {DAY_SPANS.map((value) => pill(value, value.slice(1), value === 'd1' ? t('view.range.oneDay') : t('view.range.dayCount', { count: value.slice(1) })))}
                  </div>
                  <div className="page-menu-pill-row">
                    <span className="page-menu-pill-label">{t('view.range.weeks')}</span>
                    {WEEK_SPANS.map((value) => pill(value, value.slice(1), value === 'w1' ? t('view.range.oneWeek') : t('view.range.weekCount', { count: value.slice(1) })))}
                  </div>
                  <div className="page-menu-pill-row">
                    {pill('month', t('view.range.month'), t('view.range.month'))}
                  </div>
                </>
              )}
            </MenuSection>
          )}

          {extra?.(close)}
        </>
      )}
    </MenuButton>
  );
}
