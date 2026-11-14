import { Maximize2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { WindowMenuProps } from '../../types/toolbar';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';

export function WindowItems({ fullWidth, onFullWidthChange, close }: WindowMenuProps & { close: () => void }) {
  const { t } = useI18n();
  return (
    <MenuSection label={t('view.window')}>
      <MenuItem
        label={t('view.fullWidth')}
        icon={<Maximize2 size={14} strokeWidth={1.6} />}
        shortcut="v f"
        checked={fullWidth}
        onSelect={() => {
          onFullWidthChange(!fullWidth);
          close();
        }}
      />
    </MenuSection>
  );
}

export function WindowMenu(props: WindowMenuProps) {
  const { t } = useI18n();
  return (
    <MenuButton label={t('view.window')}>
      {(close) => <WindowItems {...props} close={close} />}
    </MenuButton>
  );
}
