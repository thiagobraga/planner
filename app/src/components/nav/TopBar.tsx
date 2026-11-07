import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { MoreHorizontal, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../hooks/usePreferences';
import { useUpdatePreferences } from '../../hooks/useUpdatePreferences';
import { useI18n } from '../../i18n/I18nContext';
import { isProduction } from '../../utils/environment';
import { APP_VERSION } from '../../utils/version';
import { UpdateToast } from '../UpdateToast';
import { PlannerIcon } from './navIcons';
import { NAV_ITEMS } from './navItems';
import { InboxTopBarItem, TopBarItem } from './TopBarItem';
import { TopBarMenus } from './TopBarMenus';
import type { TopBarMenuState, TopBarProps } from '../../types/navigation';
import './TopBar.css';

export function TopBar({ onOpenSearch, onOpenShortcuts, updateAvailable = false }: TopBarProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: preferences } = usePreferences();
  const mutation = useUpdatePreferences();
  const navStyle = preferences?.navStyle ?? 'icon-left';
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [menu, setMenu] = useState<TopBarMenuState | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const change = (event: MediaQueryListEvent) => { setMobile(event.matches); setMenu(null); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  const toggleMenu = (kind: 'more' | 'account', trigger: HTMLButtonElement) => {
    if (menu?.kind === kind) { closeMenu(); return; }
    triggerRef.current = trigger;
    const rect = trigger.getBoundingClientRect();
    setMenu({ kind, position: { x: rect.left, y: rect.bottom } });
  };
  const openStyleMenu = (x: number, y: number) => {
    triggerRef.current = barRef.current;
    setMenu({ kind: 'style', position: { x, y } });
  };
  const moreActive = /^\/(settings|help|admin|styleguide)(\/|$)/.test(pathname);
  const initials = (user?.displayName || user?.email || '').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase();

  return (
    <header
      ref={barRef}
      tabIndex={-1}
      className="topbar"
      data-nav-style={navStyle}
      onContextMenu={(event) => { event.preventDefault(); openStyleMenu(event.clientX, event.clientY); }}
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          openStyleMenu(rect.left + 16, rect.bottom);
        }
      }}
    >
      <div className="topbar-brand">
        <PlannerIcon width={16} height={16} />
        <span className="topbar-brand-name">Planner {!isProduction() && <em>dev</em>}</span>
      </div>
      <nav className="topbar-nav" aria-label={t('nav.main')}>
        {NAV_ITEMS.map((item) => item.to === '/inbox'
          ? <InboxTopBarItem key={item.to} item={item} />
          : <TopBarItem key={item.to} item={item} />)}
        <button
          type="button"
          className={`topbar-item topbar-more${moreActive ? ' topbar-item--active' : ''}`}
          aria-haspopup="menu"
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={menu?.kind === 'more'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => toggleMenu('more', event.currentTarget)}
        >
          <span className="topbar-item-icon"><MoreHorizontal size={16} /></span>
          <span className="topbar-item-label">{t('nav.more')}</span>
        </button>
      </nav>
      <div className="topbar-actions">
        <div className="topbar-version-cluster">
          <span className="topbar-version" title={t('nav.version', { version: APP_VERSION })}>v{APP_VERSION}</span>
          <UpdateToast updateAvailable={updateAvailable} />
        </div>
        <button type="button" className="topbar-search topbar-icon-button" aria-label={t('common.search')} onClick={onOpenSearch}><Search size={16} /></button>
        <button
          type="button"
          className="topbar-account topbar-icon-button"
          aria-label={t('nav.account')}
          aria-haspopup="menu"
          aria-expanded={menu?.kind === 'account'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => toggleMenu('account', event.currentTarget)}
        >
          <span aria-hidden="true">{initials}</span>
          {mobile && updateAvailable && <span className="topbar-update-dot" aria-hidden="true" />}
        </button>
      </div>
      {menu && <TopBarMenus menu={menu} mobile={mobile} navStyle={navStyle} saving={mutation.isPending} onStyleChange={(style) => mutation.mutate({ navStyle: style })} onClose={closeMenu} onOpenSearch={onOpenSearch} onOpenShortcuts={onOpenShortcuts} updateAvailable={updateAvailable} />}
      {mutation.isError && <p role="alert" className="topbar-error">{t('nav.styleSaveError')}</p>}
    </header>
  );
}
