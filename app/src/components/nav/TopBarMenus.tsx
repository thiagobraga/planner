import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPreferences } from '../../api/client';
import { useTaskVisibilityPreferences } from '../../hooks/useTaskVisibilityPreferences';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
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
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences, refetchOnMount: false });
  const visibility = useTaskVisibilityPreferences(prefs, () => queryClient.invalidateQueries({ queryKey: ['daily'] }));
  const hideCompleted = prefs?.hideCompletedTasks ?? false;
  const showNotes = prefs?.showNotes ?? true;
  // What every task page shows, and the color theme; they used to live in each page's toolbar popover.
  const display: ContextMenuItem[] = [
    { type: 'header', label: <span className="topbar-menu-section">{t('menu.show')}</span> },
    { type: 'item', label: t('visibility.completedTasks'), checked: !hideCompleted, disabled: !prefs, onClick: () => visibility.setHideCompletedTasks(!hideCompleted) },
    { type: 'item', label: t('visibility.notes'), checked: showNotes, disabled: !prefs, onClick: () => visibility.setShowNotes(!showNotes) },
    { type: 'separator' },
    { type: 'header', label: <span className="topbar-menu-theme"><ThemeSwitcher /></span> },
    { type: 'separator' },
  ];
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
      {
        type: 'header',
        label: (
          <span className="topbar-menu-brand">
            <span>Bullet<b>Planner</b></span>
            <Link
              to="/changelog"
              className="topbar-menu-version"
              title={t('nav.openChangelog', { version: APP_VERSION })}
              aria-label={t('nav.openChangelog', { version: APP_VERSION })}
              onClick={onClose}
            >
              v{APP_VERSION}
            </Link>
          </span>
        ),
      },
      { type: 'header', label: <span className="topbar-account-identity"><strong>{user?.displayName || user?.email}</strong><span>{user?.email}</span></span> },
      { type: 'separator' },
      ...display,
      ...utilities,
      ...(updateAvailable ? [{ type: 'separator' as const }, { type: 'item' as const, label: `${t('update.available')} - ${t('update.refresh')}`, icon: <RefreshCw size={16} />, onClick: () => window.location.reload() }] : []),
      { type: 'separator' },
      { type: 'item', label: t('nav.logout'), icon: <LogOut size={16} />, onClick: () => { logout(); navigate('/login'); } },
    ];
  }
  return <ContextMenu items={items} position={menu.position} onClose={onClose} align={menu.kind === 'menu' ? 'end' : 'start'} />;
}
