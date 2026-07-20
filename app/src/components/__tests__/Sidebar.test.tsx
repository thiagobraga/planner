import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../Sidebar';

const mockLogout = vi.hoisted(() => vi.fn());

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
  useAuth: vi.fn(() => ({ logout: mockLogout })),
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

  it('renders styleguide link in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByText('Styleguide')).toBeInTheDocument();
  });

  it('renders CollectionTreeNav in expanded mode', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('collection-tree-nav')).toBeInTheDocument();
  });
});
