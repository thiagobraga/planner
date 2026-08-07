import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../Sidebar';

const mockLogout = vi.hoisted(() => vi.fn());
// Mutable so a test can hand the sidebar an admin, a plain user, or nobody.
const authState = vi.hoisted(() => ({ user: null as { role: string } | null }));

vi.mock('react-router', () => ({
  NavLink: vi.fn(({ to, children, className, title, ...rest }) => {
    const isActive = false;
    const cls = typeof className === 'function' ? className({ isActive }) : className;
    return (
      <a href={to} title={title} className={cls} {...rest}>
        {children}
      </a>
    );
  }),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ logout: mockLogout, user: authState.user })),
}));

vi.mock('../../contexts/PlannerDragContext', () => ({
  usePlannerDrag: vi.fn(() => ({ activeDrag: null, overId: null })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock('../CollectionTreeNav', () => ({
  CollectionTreeNav: vi.fn(() => <div data-testid="collection-tree-nav" />),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { role: 'user' };
  });

  it('renders navigation links in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Habits')).toBeInTheDocument();
  });

  it('renders Planner branding', () => {
    render(<Sidebar />);
    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Bulletjournal online')).toBeInTheDocument();
  });

  it('renders collapsed mode with icon-only bar', () => {
    const { container } = render(<Sidebar collapsed />);
    expect(container.querySelector('.sidebar-collapsed')).toBeTruthy();
  });

  it('collapsed mode hides text labels', () => {
    render(<Sidebar collapsed />);
    expect(screen.queryByText('Daily')).not.toBeInTheDocument();
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });

  it('renders collapsed nav items with title attributes', () => {
    render(<Sidebar collapsed />);
    expect(screen.getByTitle('Daily')).toBeInTheDocument();
    expect(screen.getByTitle('Inbox')).toBeInTheDocument();
    expect(screen.getByTitle('Monthly')).toBeInTheDocument();
    expect(screen.getByTitle('Habits')).toBeInTheDocument();
  });

  it('calls logout when logout button is clicked in expanded mode', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Logout'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('calls logout when logout button is clicked in collapsed mode', () => {
    render(<Sidebar collapsed />);
    fireEvent.click(screen.getByTitle('Logout'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders help link in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders help link in collapsed mode', () => {
    render(<Sidebar collapsed />);
    expect(screen.getByTitle('Help')).toBeInTheDocument();
  });

  it('renders settings link in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('hides the styleguide link from a regular user in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.queryByText('Styleguide')).not.toBeInTheDocument();
  });

  it('renders styleguide link for an admin in expanded mode', () => {
    authState.user = { role: 'admin' };
    render(<Sidebar />);
    expect(screen.getByText('Styleguide')).toBeInTheDocument();
  });

  it('renders styleguide link for an admin in collapsed mode', () => {
    authState.user = { role: 'admin' };
    render(<Sidebar collapsed />);
    expect(screen.getByTitle('Styleguide')).toBeInTheDocument();
  });

  it('renders CollectionTreeNav in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('collection-tree-nav')).toBeInTheDocument();
  });

  it('hides the admin links from a regular user', () => {
    render(<Sidebar />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('shows the admin links to an admin in expanded mode', () => {
    authState.user = { role: 'admin' };
    render(<Sidebar />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('links the admin entries to the admin routes', () => {
    authState.user = { role: 'admin' };
    render(<Sidebar />);
    expect(screen.getByText('Admin').closest('a')).toHaveAttribute('href', '/admin/dashboard');
    expect(screen.getByText('Users').closest('a')).toHaveAttribute('href', '/admin/users');
  });

  it('shows the admin links to an admin in collapsed mode', () => {
    authState.user = { role: 'admin' };
    render(<Sidebar collapsed />);
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
    expect(screen.getByTitle('Users')).toBeInTheDocument();
  });

  it('hides the admin links from a regular user in collapsed mode', () => {
    render(<Sidebar collapsed />);
    expect(screen.queryByTitle('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Users')).not.toBeInTheDocument();
  });
});
