import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Search } from 'lucide-react';
import { usePreferences } from '../../hooks/usePreferences';
import { useUpdatePreferences } from '../../hooks/useUpdatePreferences';
import { useI18n } from '../../i18n/I18nContext';
import { isProduction } from '../../utils/environment';
import { APP_VERSION } from '../../utils/version';
import { UpdateToast } from '../UpdateToast';
import { PlannerIcon } from './navIcons';
import { NAV_ITEMS } from './navItems';
import { readPhoneLabels, writePhoneLabels } from './phoneLabels';
import { InboxTopBarItem, TopBarItem } from './TopBarItem';
import { TopBarMenus } from './TopBarMenus';
import type { PhoneLabels, TopBarMenuState, TopBarProps } from '../../types/navigation';
import './TopBar.css';

const MENU_ROUTES = /^\/(settings|help|changelog|admin|styleguide)(\/|$)/;

export function TopBar({ onOpenSearch, onOpenShortcuts, updateAvailable = false }: TopBarProps) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { data: preferences } = usePreferences();
  const mutation = useUpdatePreferences();
  const navStyle = preferences?.navStyle ?? 'icon-left';
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [menu, setMenu] = useState<TopBarMenuState | null>(null);
  const [phoneLabels, setPhoneLabels] = useState<PhoneLabels>(readPhoneLabels);
  const changePhoneLabels = (value: PhoneLabels) => { writePhoneLabels(value); setPhoneLabels(value); };
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

  const toggleMenu = (trigger: HTMLButtonElement) => {
    if (menu?.kind === 'menu') { closeMenu(); return; }
    triggerRef.current = trigger;
    const rect = trigger.getBoundingClientRect();
    const bar = (barRef.current ?? trigger).getBoundingClientRect();
    setMenu({ kind: 'menu', position: { x: rect.right, y: mobile ? bar.top : bar.bottom } });
  };
  const openStyleMenu = (x: number, y: number) => {
    triggerRef.current = barRef.current;
    setMenu({ kind: 'style', position: { x, y } });
  };
  const menuRouteActive = MENU_ROUTES.test(pathname);

  return (
    <header
      ref={barRef}
      tabIndex={-1}
      className="topbar"
      data-nav-style={navStyle}
      data-phone-labels={phoneLabels}
      onContextMenu={(event) => {
        if (event.shiftKey) return;
        event.preventDefault();
        openStyleMenu(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          openStyleMenu(rect.left + 16, rect.bottom);
        }
      }}
    >
      <div className="topbar-row">
        <div className="topbar-brand">
          <span className="topbar-brand-name">Bullet<b>Planner</b>{!isProduction() && <em> dev</em>}</span>
        </div>
        <nav className="topbar-nav" aria-label={t('nav.main')}>
          {NAV_ITEMS.map((item) => item.to === '/inbox'
            ? <InboxTopBarItem key={item.to} item={item} />
            : <TopBarItem key={item.to} item={item} />)}
        </nav>
        <div className="topbar-actions">
          <div className="topbar-version-cluster">
            <Link
              to="/changelog"
              className="topbar-version"
              title={t('nav.openChangelog', { version: APP_VERSION })}
              aria-label={t('nav.openChangelog', { version: APP_VERSION })}
              aria-current={pathname === '/changelog' ? 'page' : undefined}
            >
              v{APP_VERSION}
            </Link>
            <UpdateToast updateAvailable={updateAvailable} />
          </div>
          <button type="button" className="topbar-search topbar-icon-button" aria-label={t('common.search')} onClick={onOpenSearch}><Search size={16} /></button>
          <button
            type="button"
            className={`topbar-menu-button topbar-icon-button${menuRouteActive ? ' topbar-icon-button--active' : ''}`}
            aria-label={t('nav.menu')}
            aria-haspopup="menu"
            aria-current={menuRouteActive ? 'page' : undefined}
            aria-expanded={menu?.kind === 'menu'}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => toggleMenu(event.currentTarget)}
          >
            <PlannerIcon width={16} height={16} className="topbar-menu-icon" />
            {updateAvailable && <span className="topbar-update-dot" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menu && <TopBarMenus menu={menu} mobile={mobile} navStyle={navStyle} saving={mutation.isPending} onStyleChange={(style) => mutation.mutate({ navStyle: style })} phoneLabels={phoneLabels} onPhoneLabelsChange={changePhoneLabels} onClose={closeMenu} onOpenSearch={onOpenSearch} onOpenShortcuts={onOpenShortcuts} updateAvailable={updateAvailable} />}
      {mutation.isError && <p role="alert" className="topbar-error">{t('nav.styleSaveError')}</p>}
    </header>
  );
}
