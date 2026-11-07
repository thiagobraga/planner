import { ChevronRight, FolderOpen, Repeat2 } from 'lucide-react';
import { CalendarDayIcon } from './navIcons';
import type { NavItem, NavStyle } from '../../types/navigation';
import type { TranslationKey } from '../../i18n/catalogs';

export const NAV_ITEMS: NavItem[] = [
  { to: '/daily', labelKey: 'nav.daily', Icon: CalendarDayIcon },
  { to: '/inbox', labelKey: 'nav.inbox', Icon: ChevronRight },
  { to: '/habits', labelKey: 'nav.habits', Icon: Repeat2 },
  { to: '/collections', labelKey: 'nav.collections', Icon: FolderOpen },
];

export const NAV_STYLE_LABELS: Record<NavStyle, TranslationKey> = {
  text: 'nav.styleText',
  'icon-left': 'nav.styleIconLeft',
  'icon-top': 'nav.styleIconTop',
};
