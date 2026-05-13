import { NavLink } from 'react-router-dom';

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
}

const DEFAULT_PROJECTS: Project[] = [];

const NAV_ITEMS = [
  { to: '/inbox', label: 'Inbox', icon: '⬚' },
  { to: '/today', label: 'Today', icon: '◎' },
  { to: '/upcoming', label: 'Upcoming', icon: '▷' },
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

export function Sidebar({ isOpen, onClose, projects = DEFAULT_PROJECTS }: SidebarProps) {
  const sidebarContent = (
    <aside
      className={`sidebar-drawer ${isOpen !== false ? 'sidebar-drawer--open' : ''}`}
      style={{
        width: '240px',
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
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '20px',
          lineHeight: '24px',
          height: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: '0 0 24px 12px',
          padding: 0,
        }}
      >
        planner
      </h1>

      {/* Main nav */}
      <nav aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center no-underline ${isActive ? 'font-medium' : 'opacity-60 hover:opacity-100'}`
            }
            style={({ isActive }) => ({
              height: '32px',
              lineHeight: '32px',
              padding: '0 12px',
              fontSize: '14px',
              color: 'var(--color-ink)',
              backgroundColor: isActive ? 'rgba(212,207,199,0.5)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              borderRadius: '4px',
              marginBottom: '2px',
            })}
          >
            <span style={{ width: '16px', textAlign: 'center', fontSize: '12px', opacity: 0.6 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects */}
      <div style={{ marginTop: '28px', flex: 1 }}>
        <div
          style={{
            fontSize: '10px',
            lineHeight: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            fontWeight: 500,
            padding: '0 12px',
            marginBottom: '4px',
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
