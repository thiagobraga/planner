import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronRight, Repeat2, Settings, HelpCircle, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectTreeNav } from './ProjectTreeNav';

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

const PlannerIcon = ({ size = 16 }: { size?: number }) => (
  <img src="/images/bulletjournal-planner-16x16.png" width={size} height={size} alt="" className="block shrink-0" />
);

type NavItem = { to: string; label: string; Icon: LucideIcon | React.ComponentType<{ size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Daily', Icon: BjTask },
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
        className="w-12 h-full flex flex-col items-center border-r border-dot bg-sidebar-bg py-6 shrink-0 overflow-y-auto"
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

          <button
            type="button"
            onClick={onOpenHelp}
            title="Help"
            className="sidebar-icon-link"
          >
            <HelpCircle size={16} strokeWidth={1.5} />
          </button>

          <div className="w-8 h-px bg-dot opacity-30 my-1"></div>

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="sidebar-icon-link"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </aside>
    );
  }

  const sidebarContent = (
    <aside
      className={`sidebar-drawer ${isOpen !== false ? 'sidebar-drawer--open' : ''} w-[180px] h-full flex flex-col border-r border-dot bg-sidebar-bg relative overflow-y-auto shrink-0`}
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
          <NavLink
            key={entry.to}
            to={entry.to}
            className={({ isActive }) =>
              `flex items-center no-underline h-6 px-3 text-sm text-ink gap-[7px] rounded leading-none ${
                isActive ? 'font-medium bg-dot/50' : 'opacity-60 hover:opacity-100 bg-transparent'
              }`
            }
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-60">
              <entry.Icon size={15} strokeWidth={1.5} />
            </span>
            <span className="leading-none">{entry.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects */}
      <ProjectTreeNav />

      {/* Footer utilities */}
      <div className="mt-auto border-t border-dot pt-4">
        <div className="flex flex-col">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center no-underline h-6 px-3 text-sm text-ink gap-[7px] rounded m-0 p-0 leading-none ${
                isActive ? 'font-medium bg-dot/50' : 'opacity-60 hover:opacity-100 bg-transparent'
              }`
            }
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-60">
              <Settings size={15} strokeWidth={1.5} />
            </span>
            <span className="leading-none">Settings</span>
          </NavLink>

          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center h-6 px-3 text-sm text-ink gap-[7px] rounded opacity-60 hover:opacity-100 bg-transparent border-0 cursor-pointer text-left m-0 p-0 font-inherit leading-none"
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-60">
              <HelpCircle size={15} strokeWidth={1.5} />
            </span>
            <span className="leading-none">Help</span>
          </button>

          <div className="border-t border-dot my-2 mx-3"></div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center h-6 px-3 text-sm text-ink gap-[7px] rounded opacity-60 hover:opacity-100 bg-transparent border-0 cursor-pointer text-left m-0 p-0 font-inherit leading-none"
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-60">
              <LogOut size={15} strokeWidth={1.5} />
            </span>
            <span className="leading-none">Logout</span>
          </button>
        </div>
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
