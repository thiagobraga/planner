import { useI18n } from '../../i18n/I18nContext';
import type { GroupByMenuProps } from '../../types/toolbar';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';

/** Takes the place of date navigation on pages without dates. */
export function GroupByMenu<T extends string>({ value, options, onChange, sheet }: GroupByMenuProps<T>) {
  const { t } = useI18n();
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <MenuButton label={t('view.groupBy', { group: current.label })} align="start" sheet={sheet}>
      {(close) => (
        <MenuSection label={t('board.groupBy')}>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              label={option.label}
              icon={option.icon}
              checked={option.value === value}
              onSelect={() => {
                onChange(option.value);
                close();
              }}
            />
          ))}
        </MenuSection>
      )}
    </MenuButton>
  );
}
