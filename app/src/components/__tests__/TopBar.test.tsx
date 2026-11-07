import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../nav/TopBar';

const state = vi.hoisted(() => ({
  style: 'icon-left', mobile: false, admin: false, dragging: false,
  mutate: vi.fn(), logout: vi.fn(), droppable: vi.fn(),
}));
vi.mock('../../hooks/usePreferences', () => ({ usePreferences: () => ({ data: { navStyle: state.style } }) }));
vi.mock('../../hooks/useUpdatePreferences', () => ({ useUpdatePreferences: () => ({ mutate: state.mutate, isPending: false, isError: false }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: { displayName: 'Alex Writer', email: 'alex@example.com', role: state.admin ? 'admin' : 'user' }, logout: state.logout,
}) }));
vi.mock('../../contexts/usePlannerDrag', () => ({ usePlannerDrag: () => ({ activeDrag: state.dragging ? { kind: 'task' } : null, overId: state.dragging ? 'topbar-inbox' : null }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [{ id: 'inbox-id', isInbox: true }] }) }));
vi.mock('@dnd-kit/core', () => ({ useDroppable: (options: unknown) => { state.droppable(options); return { setNodeRef: vi.fn() }; } }));

function renderBar(route = '/daily/list') {
  const onOpenSearch = vi.fn();
  const onOpenShortcuts = vi.fn();
  const view = render(<MemoryRouter initialEntries={[route]}><TopBar onOpenSearch={onOpenSearch} onOpenShortcuts={onOpenShortcuts} /></MemoryRouter>);
  return { ...view, onOpenSearch, onOpenShortcuts };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.style = 'icon-left'; state.mobile = false; state.admin = false; state.dragging = false;
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: state.mobile, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
});

describe('TopBar', () => {
  it.each(['text', 'icon-left', 'icon-top'])('renders %s with one active primary link', (style) => {
    state.style = style;
    const { container } = renderBar();
    expect(container.querySelector('.topbar')).toHaveAttribute('data-nav-style', style);
    expect(screen.getByRole('link', { name: 'Daily' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inbox' })).not.toHaveAttribute('aria-current');
  });

  it('marks Collections active inside a collection', () => {
    renderBar('/collection/example');
    expect(screen.getByRole('link', { name: 'Collections' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens More with utilities, shortcuts and only authorized admin actions', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toHaveTextContent('g s');
    expect(screen.getByRole('menuitem', { name: /Keyboard shortcuts/i })).toHaveTextContent('?');
    expect(screen.queryByRole('menuitem', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('shows admin destinations in More', () => {
    state.admin = true;
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    for (const name of ['Dashboard', 'Users', 'Compare', 'Styleguide']) expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
  });

  it('closes an open trigger without reopening and restores focus', () => {
    renderBar();
    const trigger = screen.getByRole('button', { name: 'More' });
    fireEvent.click(trigger);
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens search and shortcuts using existing callbacks', () => {
    const { onOpenSearch, onOpenShortcuts } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Keyboard shortcuts/i }));
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
  });

  it('shows identity and logout in desktop account menu', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Alex Writer')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Search' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    expect(state.logout).toHaveBeenCalledOnce();
  });

  it('puts phone utilities in account menu without keyboard hints', () => {
    state.mobile = true;
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menuitem', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByText('g s')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it('changes style through checked context menu choices', () => {
    const { container } = renderBar();
    fireEvent.contextMenu(container.querySelector('.topbar')!, { clientX: 40, clientY: 20 });
    expect(screen.getByRole('menuitemradio', { name: 'Icon left' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Text only' }));
    expect(state.mutate).toHaveBeenCalledWith({ navStyle: 'text' });
  });

  it('registers Inbox as a collection target and suppresses drag navigation', () => {
    state.dragging = true;
    renderBar('/habits');
    expect(state.droppable).toHaveBeenCalledWith(expect.objectContaining({ id: 'topbar-inbox', data: { kind: 'collection', collectionId: 'inbox-id', isInbox: true, parentId: null }, disabled: false }));
    const inbox = screen.getByRole('link', { name: 'Inbox' });
    expect(inbox.closest('[data-drop-target]')).toHaveAttribute('data-drop-target', 'true');
    expect(fireEvent.click(inbox)).toBe(false);
  });

  it('keeps the calendar day current across midnight', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      vi.setSystemTime(new Date(2026, 8, 23, 23, 59));
      renderBar();
      expect(screen.getByTestId('daily-day-number')).toHaveTextContent('23');
      act(() => vi.advanceTimersByTime(120000));
      expect(screen.getByTestId('daily-day-number')).toHaveTextContent('24');
    } finally { vi.useRealTimers(); }
  });
});
