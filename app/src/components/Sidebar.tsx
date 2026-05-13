import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/inbox', label: 'Inbox', icon: '•' },
  { to: '/today', label: 'Today', icon: '○' },
  { to: '/upcoming', label: 'Upcoming', icon: '>' },
];

export function Sidebar() {
  return (
    <aside
      className="h-screen flex flex-col border-r border-[var(--color-dot)]"
      style={{
        width: '240px',
        padding: '24px',
        backgroundColor: 'var(--color-sidebar-bg)',
      }}
    >
      {/* Logo — fits 1 grid row */}
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '22px',
          lineHeight: '24px',
          height: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: '0 0 24px 0',
          padding: 0,
        }}
      >
        planner
      </h1>

      {/* Nav items — each 24px tall with 24px line-height */}
      <nav className="flex flex-col" style={{ gap: '0px' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center no-underline rounded ${
                isActive
                  ? 'font-medium'
                  : 'opacity-60 hover:opacity-100'
              }`
            }
            style={({ isActive }) => ({
              height: '24px',
              lineHeight: '24px',
              padding: '0 12px',
              fontSize: '14px',
              color: 'var(--color-ink)',
              backgroundColor: isActive ? 'var(--color-cream)' : 'transparent',
              gap: '12px',
              marginBottom: '0px',
            })}
          >
            <span style={{ width: '12px', textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects section — starts on grid line */}
      <div style={{ marginTop: '48px' }}>
        <h2
          style={{
            fontSize: '10px',
            lineHeight: '24px',
            height: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            margin: 0,
            padding: '0 12px',
            fontWeight: 500,
          }}
        >
          Projects
        </h2>
        <div
          style={{
            fontSize: '13px',
            lineHeight: '24px',
            height: '24px',
            color: 'var(--color-ink-light)',
            padding: '0 12px',
            fontStyle: 'italic',
          }}
        >
          No projects yet
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-auto"
        style={{
          borderTop: '1px solid var(--color-dot)',
          paddingTop: '23px', /* 24px - 1px border */
        }}
      >
        <div
          style={{
            fontSize: '11px',
            lineHeight: '24px',
            height: '24px',
            color: 'var(--color-ink-light)',
            padding: '0 12px',
          }}
        >
          Press{' '}
          <kbd
            style={{
              padding: '2px 6px',
              backgroundColor: 'var(--color-cream)',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'monospace',
              border: '1px solid var(--color-dot)',
            }}
          >
            q
          </kbd>{' '}
          to quick-add
        </div>
      </div>
    </aside>
  );
}
