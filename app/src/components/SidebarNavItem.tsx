import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarNavItemProps {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

const BASE_CLASS =
  'flex items-center h-6 !px-3 gap-[7px] rounded text-sm leading-none text-ink font-[inherit]';

export function SidebarNavItem({ label, icon, to, onClick, active = false }: SidebarNavItemProps) {
  const content = (
    <>
      <span className="w-4 flex items-center justify-center shrink-0 opacity-60">{icon}</span>
      <span className="leading-none">{label}</span>
    </>
  );

  const stateClass = active ? 'font-medium bg-dot/50' : 'opacity-60 hover:opacity-100 bg-transparent';

  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          `${BASE_CLASS} w-full no-underline focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${isActive ? 'font-medium bg-dot/50' : 'opacity-60 hover:opacity-100 bg-transparent'}`
        }
      >
        {content}
      </NavLink>
    );
  }

  if (!onClick) {
    return <span className={`${BASE_CLASS} w-full ${stateClass}`}>{content}</span>;
  }

  return (
    <a
      href="#"
      role="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`${BASE_CLASS} w-full appearance-none bg-transparent border-0 cursor-pointer text-left focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${stateClass}`}
    >
      {content}
    </a>
  );
}
