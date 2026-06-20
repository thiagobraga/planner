import { NavLink } from 'react-router-dom';
import { ChevronRight, Repeat2, type LucideIcon } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color?: string;
  children?: Project[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  projects?: Project[];
  collapsed?: boolean;
}

const DEFAULT_PROJECTS: Project[] = [];


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
  <img src="/images/bulletjournal-planner-16x16.png" width={size} height={size} alt="" style={{ display: 'block', flexShrink: 0 }} />
);

type NavItem = { to: string; label: string; Icon: LucideIcon | React.ComponentType<{ size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Daily', Icon: BjTask },
  { to: '/inbox', label: 'Inbox', Icon: ChevronRight },
  { to: '/monthly', label: 'Monthly', Icon: MonthlyIcon },
  { to: '/habits', label: 'Habits', Icon: Repeat2 },
];

function ProjectNode({ project, depth = 0 }: { project: Project; depth?: number }) {
  return (
    <>
      <NavLink
        to={`/project/${project.id}`}
        className={({ isActive }) =>
          `flex items-center no-underline rounded ${isActive ? 'font-medium' : 'opacity-60 hover:opacity-100'}`
        }
        style={({ isActive }) => ({
          height: '24px',
          lineHeight: '24px',
          paddingLeft: `${12 + depth * 16}px`,
          paddingRight: '12px',
          fontSize: '13px',
          color: 'var(--color-ink)',
          backgroundColor: isActive ? 'rgba(212,207,199,0.5)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          borderRadius: '4px',
        })}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: project.color ?? 'var(--color-ink-light)',
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
      </NavLink>
      {project.children?.map((child) => (
        <ProjectNode key={child.id} project={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function Sidebar({ isOpen, onClose, projects = DEFAULT_PROJECTS, collapsed = false }: SidebarProps) {
  if (collapsed) {
    return (
      <aside
        style={{
          width: '48px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRight: '1px solid var(--color-dot)',
          backgroundColor: 'var(--color-sidebar-bg)',
          padding: '24px 0',
          flexShrink: 0,
          overflowY: 'auto',
        }}
        aria-label="Navigation"
      >
        {/* Logo mark */}
        <div style={{ marginBottom: '24px' }} title="Planner">
          <PlannerIcon size={16} />
        </div>

        <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
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
      className={`sidebar-drawer ${isOpen !== false ? 'sidebar-drawer--open' : ''}`}
      style={{
        width: '180px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-dot)',
        backgroundColor: 'var(--color-sidebar-bg)',
        padding: '24px 12px',
        position: 'relative',
        overflowY: 'auto',
        flexShrink: 0,
      }}
      aria-label="Navigation"
    >
      {/* Logo */}
      <div
        style={{
          margin: '0 0 24px 12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flexShrink: 0 }}><PlannerIcon size={14} /></div>
            <h1
              style={{
                fontFamily: '"Lora", serif',
                fontSize: '18px',
                lineHeight: '24px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: 0,
                padding: 0,
              }}
            >
              Planner
            </h1>
          </div>
          <p
            style={{
              fontSize: '13px',
              lineHeight: '24px',
              color: 'var(--color-ink-light)',
              margin: 0,
              padding: 0,
              opacity: 0.6,
            }}
          >
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
              `flex items-center no-underline ${isActive ? 'font-medium' : 'opacity-60 hover:opacity-100'}`
            }
            style={({ isActive }) => ({
              height: '24px',
              lineHeight: '24px',
              padding: '0 12px',
              fontSize: '14px',
              color: 'var(--color-ink)',
              backgroundColor: isActive ? 'rgba(212,207,199,0.5)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              textDecoration: 'none',
              borderRadius: '4px',
            })}
          >
            <span style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
              <entry.Icon size={15} strokeWidth={1.5} />
            </span>
            <span>{entry.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects */}
      <div style={{ marginTop: '24px', flex: 1 }}>
        <div
          style={{
            fontSize: '10px',
            lineHeight: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            fontWeight: 500,
            padding: '0 12px',
          }}
        >
          Projects
        </div>
        {projects.length === 0 ? (
          <div
            style={{
              fontSize: '12px',
              lineHeight: '24px',
              color: 'var(--color-ink-light)',
              padding: '0 12px',
              fontStyle: 'italic',
              opacity: 0.6,
            }}
          >
            No projects yet
          </div>
        ) : (
          projects.map((p) => <ProjectNode key={p.id} project={p} />)
        )}
      </div>

      {/* Footer shortcuts hint */}
      <div
        style={{
          borderTop: '1px solid var(--color-dot)',
          paddingTop: '16px',
          marginTop: '16px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-ink-light)',
            padding: '0 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {[
            ['q', 'quick add'],
            ['/', 'search'],
            ['?', 'shortcuts'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <kbd
                style={{
                  padding: '1px 5px',
                  background: 'var(--color-cream)',
                  border: '1px solid var(--color-dot)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {key}
              </kbd>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>{desc}</span>
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
