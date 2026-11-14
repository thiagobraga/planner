import { useNavigate } from 'react-router';
import { HelpCircle, Keyboard, LogOut, RefreshCw, Search, Settings, ShieldCheck, Table2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { ContextMenu } from '../ui/ContextMenu';
import { StyleguideIcon } from './navIcons';
import { APP_VERSION } from '../../utils/version';
import { NAV_STYLE_LABELS } from './navItems';
import type { ContextMenuItem } from '../../types/contextMenu';
import type { NavStyle, TopBarMenusProps } from '../../types/navigation';

export function TopBarMenus({ menu, mobile, navStyle, saving, onStyleChange, phoneLabels, onPhoneLabelsChange, onClose, onOpenSearch, onOpenShortcuts, updateAvailable }: TopBarMenusProps) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  let items: ContextMenuItem[];
  const utilities: ContextMenuItem[] = [
    ...(mobile ? [{ type: 'item' as const, label: t('common.search'), icon: <Search size={16} />, onClick: onOpenSearch }] : []),
    { type: 'item', label: t('common.settings'), icon: <Settings size={16} />, shortcut: mobile ? undefined : 'g s', onClick: () => navigate('/settings') },
    { type: 'item', label: t('nav.help'), icon: <HelpCircle size={16} />, onClick: () => navigate('/help') },
    ...(!mobile ? [{ type: 'item' as const, label: t('shell.keyboardShortcuts'), icon: <Keyboard size={16} />, shortcut: '?', onClick: onOpenShortcuts }] : []),
    ...(user?.role === 'admin' ? [
      { type: 'separator' as const },
      { type: 'item' as const, label: t('nav.adminDashboard'), icon: <ShieldCheck size={16} />, onClick: () => navigate('/admin/dashboard') },
      { type: 'item' as const, label: t('nav.adminUsers'), icon: <Users size={16} />, onClick: () => navigate('/admin/users') },
      { type: 'item' as const, label: t('nav.adminCompare'), icon: <Table2 size={16} />, onClick: () => navigate('/admin/compare') },
      { type: 'item' as const, label: t('nav.styleguide'), icon: <StyleguideIcon size={16} />, onClick: () => navigate('/styleguide') },
    ] : []),
  ];
  if (menu.kind === 'style' && mobile) {
    items = [{ type: 'item', label: t('nav.showText'), checked: phoneLabels === 'shown', onClick: () => onPhoneLabelsChange(phoneLabels === 'shown' ? 'hidden' : 'shown') }];
  } else if (menu.kind === 'style') {
    items = (Object.keys(NAV_STYLE_LABELS) as NavStyle[]).map((style) => ({
      type: 'item', label: t(NAV_STYLE_LABELS[style]), checked: style === navStyle, disabled: saving,
      onClick: () => onStyleChange(style),
    }));
  } else {
    items = [
      { type: 'item', disabled: true, label: <span className="topbar-menu-brand"><span>Bullet<b>Planner</b></span><span className="topbar-menu-version">v{APP_VERSION}</span></span> },
      { type: 'item', disabled: true, label: <span className="topbar-account-identity"><strong>{user?.displayName || user?.email}</strong><span>{user?.email}</span></span> },
      { type: 'separator' },
      ...utilities,
      ...(updateAvailable ? [{ type: 'separator' as const }, { type: 'item' as const, label: `${t('update.available')} - ${t('update.refresh')}`, icon: <RefreshCw size={16} />, onClick: () => window.location.reload() }] : []),
      { type: 'separator' },
      { type: 'item', label: t('nav.logout'), icon: <LogOut size={16} />, onClick: () => { logout(); navigate('/login'); } },
    ];
  }
  return <ContextMenu items={items} position={menu.position} onClose={onClose} align={menu.kind === 'menu' ? 'end' : 'start'} />;
}
