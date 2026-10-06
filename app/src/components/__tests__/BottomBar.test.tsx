import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomBar } from '../BottomBar';

vi.mock('react-router', () => ({
  NavLink: vi.fn(({ to, children, className, onClick }) => {
    const cls = typeof className === 'function' ? className({ isActive: false }) : className;
    return (
      <a href={to} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ logout: vi.fn(), user: null })),
}));

vi.mock('../../contexts/usePlannerDrag', () => ({
  usePlannerDrag: vi.fn(() => ({ activeDrag: null, overId: null })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

describe('BottomBar', () => {
  it('renders each destination exactly once', () => {
    render(<BottomBar isMenuOpen={false} onMenuToggle={vi.fn()} onNavigate={vi.fn()} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/daily', '/inbox', '/habits', '/collections']);
  });

  it('renders the More button', () => {
    render(<BottomBar isMenuOpen={false} onMenuToggle={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });
});
