import { NavLink } from 'react-router';
import { FolderOpen, MoreVertical } from 'lucide-react';
import { NAV_ITEMS } from './Sidebar';
import { useI18n } from '../i18n/I18nContext';

const BOTTOM_BAR_ITEMS = [
  ...NAV_ITEMS.filter((item) => item.to !== '/monthly'),
  { to: '/collections', labelKey: 'nav.collections' as const, Icon: FolderOpen },
];

interface BottomBarProps {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onNavigate: () => void;
}

export function BottomBar({ isMenuOpen, onMenuToggle, onNavigate }: BottomBarProps) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('nav.main')} className="bottom-bar">
      {BOTTOM_BAR_ITEMS.map(({ to, labelKey, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => `bottom-bar-item${isActive ? ' bottom-bar-item--active' : ''}`}
        >
          <Icon size={20} strokeWidth={1.5} />
          <span className="bottom-bar-label">{t(labelKey)}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label={t('nav.open')}
        aria-expanded={isMenuOpen}
        className={`bottom-bar-item${isMenuOpen ? ' bottom-bar-item--active' : ''}`}
      >
        <MoreVertical size={20} strokeWidth={1.5} />
        <span className="bottom-bar-label">{t('nav.more')}</span>
      </button>
    </nav>
  );
}
