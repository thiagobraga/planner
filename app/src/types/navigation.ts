import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../i18n/catalogs';

export type NavStyle = 'text' | 'icon-left' | 'icon-top';
export type PhoneLabels = 'shown' | 'hidden';

export interface NavIconProps { size?: number }
export interface PlannerIconProps { width: number; height: number; className?: string }
export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  Icon: LucideIcon | ComponentType<NavIconProps>;
}
export interface TopBarProps {
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  updateAvailable?: boolean;
}
export interface TopBarItemProps { item: NavItem }
export interface TopBarMenuState {
  kind: 'menu' | 'style';
  position: { x: number; y: number };
}
export interface TopBarMenusProps extends TopBarProps {
  menu: TopBarMenuState;
  mobile: boolean;
  navStyle: NavStyle;
  saving: boolean;
  onStyleChange: (style: NavStyle) => void;
  phoneLabels: PhoneLabels;
  onPhoneLabelsChange: (value: PhoneLabels) => void;
  onClose: () => void;
}
