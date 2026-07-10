import { NavLink } from 'react-router-dom';
import { ChevronRight, Repeat2, type LucideIcon } from 'lucide-react';
import { ProjectTreeNav } from './ProjectTreeNav';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
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

export function Sidebar({ isOpen, onClose, collapsed = false }: SidebarProps) {
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
      <nav aria-label="Main navigation">
        {NAV_ITEMS.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            className={({ isActive }) =>
              `flex items-center no-underline h-6 leading-6 px-3 text-sm text-ink gap-[7px] rounded ${
                isActive ? 'font-medium bg-dot/50' : 'opacity-60 hover:opacity-100 bg-transparent'
              }`
            }
          >
            <span className="w-4 flex items-center justify-center opacity-60">
              <entry.Icon size={15} strokeWidth={1.5} />
            </span>
            <span>{entry.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects */}
      <ProjectTreeNav />

      {/* Footer shortcuts hint */}
      <div className="border-t border-dot pt-4 mt-4">
        <div className="text-[11px] text-ink-light px-3 flex flex-col gap-1">
          {[
            ['q', 'quick add'],
            ['/', 'search'],
            ['?', 'shortcuts'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd>{key}</kbd>
              <span className="opacity-70 text-[11px]">{desc}</span>
            </div>
          ))}
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
