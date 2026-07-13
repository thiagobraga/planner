import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronRight, Repeat2, Settings, HelpCircle, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectTreeNav } from './ProjectTreeNav';
import { SidebarNavItem } from './SidebarNavItem';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onOpenHelp?: () => void;
}

export const BjTask = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
  </svg>
);

export const MonthlyIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <circle cx="3" cy="4" r="1" fill="currentColor" />
    <circle cx="3" cy="7.5" r="1" fill="currentColor" />
    <circle cx="3" cy="11" r="1" fill="currentColor" />
    <path d="M6 4H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M6 7.5H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M6 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const StyleguideIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 5.5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M4 8H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M4 10.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const PlannerIcon = ({ size = 16 }: { size?: number }) => (
  <img src="/images/bulletjournal-planner-16x16.png" width={size} height={size} alt="" className="block shrink-0" />
);

type NavItem = { to: string; label: string; Icon: LucideIcon | React.ComponentType<{ size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { to: '/daily', label: 'Daily', Icon: BjTask },
  { to: '/inbox', label: 'Inbox', Icon: ChevronRight },
  { to: '/monthly', label: 'Monthly', Icon: MonthlyIcon },
  { to: '/habits', label: 'Habits', Icon: Repeat2 },
];

export function Sidebar({ isOpen, onClose, collapsed = false, onOpenHelp }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  if (collapsed) {
    return (
      <aside
        className="w-12 h-full flex flex-col items-center border-r border-dot bg-[var(--planner-sidebar-bg)] py-6 shrink-0 overflow-y-auto"
        aria-label="Navigation"
      >
        {/* Logo mark */}
        <div className="mb-6" title="Planner">
          <PlannerIcon size={16} />
        </div>

        <nav aria-label="Main navigation" className="flex flex-col gap-0.5 w-full items-center">
          {NAV_ITEMS.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              title={entry.label}
              className={({ isActive }) => (isActive ? 'sidebar-icon-link sidebar-icon-link--active' : 'sidebar-icon-link')}
            >
              <entry.Icon size={16} strokeWidth={1.5} />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 w-full items-center pb-6">
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) => (isActive ? 'sidebar-icon-link sidebar-icon-link--active' : 'sidebar-icon-link')}
          >
            <Settings size={16} strokeWidth={1.5} />
          </NavLink>

          <NavLink
            to="/styleguide"
            title="Styleguide"
            className={({ isActive }) => (isActive ? 'sidebar-icon-link sidebar-icon-link--active' : 'sidebar-icon-link')}
          >
            <StyleguideIcon size={16} />
          </NavLink>

          <a
            href="#"
            role="button"
            onClick={(e) => {
              e.preventDefault();
              onOpenHelp?.();
            }}
            title="Help"
            className="sidebar-icon-link"
          >
            <HelpCircle size={16} strokeWidth={1.5} />
          </a>

          <div className="w-8 h-px bg-dot opacity-30 my-1"></div>

          <a
            href="#"
            role="button"
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
            title="Logout"
            className="sidebar-icon-link"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </a>
        </div>
      </aside>
    );
  }

  const sidebarContent = (
    <aside
      className={`sidebar-drawer ${isOpen !== false ? 'sidebar-drawer--open' : ''} w-[220px] h-full flex flex-col border-r border-dot bg-[var(--planner-sidebar-bg)] relative overflow-y-auto shrink-0`}
      aria-label="Navigation"
    >
      {/* Logo */}
      <div className="mb-6 ml-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="shrink-0"><PlannerIcon size={14} /></div>
            <h1 className="text-lg leading-6 font-semibold text-ink m-0 p-0">
              Planner
            </h1>
          </div>
          <p className="text-[13px] leading-6 text-ink-light m-0 p-0 opacity-60">
            Bulletjournal online
          </p>
        </div>
      </div>

      {/* Main nav */}
      <nav aria-label="Main navigation" className="flex flex-col">
        {NAV_ITEMS.map((entry) => (
          <SidebarNavItem
            key={entry.to}
            to={entry.to}
            label={entry.label}
            icon={<entry.Icon size={15} strokeWidth={1.5} />}
          />
        ))}
      </nav>

      {/* Projects */}
      <ProjectTreeNav />

      {/* Footer utilities */}
      <div className="mt-auto pt-4">
        <nav aria-label="Settings" className="flex flex-col">
          <SidebarNavItem to="/settings" label="Settings" icon={<Settings size={15} strokeWidth={1.5} />} />
          <SidebarNavItem to="/styleguide" label="Styleguide" icon={<StyleguideIcon size={15} />} />
          <SidebarNavItem label="Help" icon={<HelpCircle size={15} strokeWidth={1.5} />} onClick={onOpenHelp} />

          <div className="border-t border-dot my-3 mx-0"></div>

          <SidebarNavItem label="Logout" icon={<LogOut size={15} strokeWidth={1.5} />} onClick={handleLogout} />
        </nav>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {sidebarContent}
    </>
  );
}
