import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../nav/TopBar';
import { isProduction } from '../../utils/environment';

vi.mock('../../utils/environment', () => ({ isProduction: vi.fn(() => false) }));

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
  vi.mocked(isProduction).mockReturnValue(false);
  state.style = 'icon-left'; state.mobile = false; state.admin = false; state.dragging = false;
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: state.mobile, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
});

describe('TopBar', () => {
  it.each([false, true])('renders the joined wordmark with production=%s', (production) => {
    vi.mocked(isProduction).mockReturnValue(production);
    const { container } = renderBar();
    const brand = container.querySelector('.topbar-brand-name');
    expect(brand?.firstChild?.textContent).toBe('Bullet');
    expect(brand?.querySelector('b')).toHaveTextContent(/^Planner$/);
    expect(brand).toHaveTextContent(production ? /^BulletPlanner$/ : /^BulletPlanner dev$/);
    expect(brand?.querySelector('em') !== null).toBe(!production);
  });

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

  it('keeps the wordmark without the book icon and has no More button', () => {
    const { container } = renderBar();
    expect(container.querySelector('.topbar-brand img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('lays out wordmark, tabs and actions inside one centered row', () => {
    const { container } = renderBar();
    const row = container.querySelector('.topbar > .topbar-row');
    expect(row).not.toBeNull();
    expect([...row!.children].map((child) => child.className.split(' ')[0])).toEqual(['topbar-brand', 'topbar-nav', 'topbar-actions']);
    const actions = row!.querySelector('.topbar-actions')!;
    expect(actions.lastElementChild).toBe(screen.getByRole('button', { name: 'Planner menu' }));
  });

  it('uses the Planner icon as the menu button on every width', () => {
    for (const mobile of [false, true]) {
      state.mobile = mobile;
      const { unmount } = renderBar();
      const button = screen.getByRole('button', { name: 'Planner menu' });
      expect(button.querySelector('img.planner-icon-light')).not.toBeNull();
      expect(button).not.toHaveTextContent('AW');
      unmount();
    }
  });

  it('opens one menu with name, version, identity, utilities and logout', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Planner menu' }));
    const menu = screen.getByRole('menu');
    expect(menu.querySelector('.topbar-menu-brand')).toHaveTextContent(/BulletPlanner/);
    expect(menu.querySelector('.topbar-menu-brand')).toHaveTextContent(/v\d+\.\d+\.\d+/);
    expect(screen.getByText('Alex Writer')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toHaveTextContent('g s');
    expect(screen.getByRole('menuitem', { name: /Help/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Keyboard shortcuts/i })).toHaveTextContent('?');
    expect(screen.queryByRole('menuitem', { name: 'Search' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Users' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    expect(state.logout).toHaveBeenCalledOnce();
  });

  it('shows admin destinations in the menu', () => {
    state.admin = true;
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Planner menu' }));
    for (const name of ['Dashboard', 'Users', 'Compare', 'Styleguide']) expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
  });

  it('offers the update refresh in the menu on desktop too', () => {
    render(<MemoryRouter><TopBar onOpenSearch={vi.fn()} onOpenShortcuts={vi.fn()} updateAvailable /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Planner menu' });
    expect(button.querySelector('.topbar-update-dot')).not.toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole('menuitem', { name: /New version available/ })).toBeInTheDocument();
  });

  it.each(['/settings/general', '/help', '/admin/users', '/styleguide'])('marks the menu button current on %s', (route) => {
    renderBar(route);
    expect(screen.getByRole('button', { name: 'Planner menu' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves the menu button plain on primary tabs', () => {
    renderBar('/inbox');
    expect(screen.getByRole('button', { name: 'Planner menu' })).not.toHaveAttribute('aria-current');
  });

  it('closes an open trigger without reopening and restores focus', () => {
    renderBar();
    const trigger = screen.getByRole('button', { name: 'Planner menu' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Planner menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Keyboard shortcuts/i }));
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
  });

  it('puts phone utilities in the menu without keyboard hints', () => {
    state.mobile = true;
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Planner menu' }));
    expect(screen.getByRole('menu').querySelector('.topbar-menu-brand')).toHaveTextContent(/BulletPlanner/);
    expect(screen.getByRole('menuitem', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByText('g s')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it('uses the inbox tray icon for Inbox', () => {
    renderBar();
    expect(screen.getByRole('link', { name: 'Inbox' }).querySelector('svg.lucide-inbox')).not.toBeNull();
  });

  it('draws Daily as a plain square with a bold day and no binder rings', () => {
    renderBar();
    const day = screen.getByTestId('daily-day-number');
    expect(day).toHaveAttribute('font-weight', '700');
    const svg = day.closest('svg')!;
    expect(svg.querySelector('path')).toBeNull();
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('changes style through checked context menu choices', () => {
    const { container } = renderBar();
    fireEvent.contextMenu(container.querySelector('.topbar')!, { clientX: 40, clientY: 20 });
    expect(screen.getByRole('menuitemradio', { name: 'Text right' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Text only' }));
    expect(state.mutate).toHaveBeenCalledWith({ navStyle: 'text' });
  });

  it('leaves the browser menu alone on shift + right click', () => {
    const { container } = renderBar();
    const notPrevented = fireEvent.contextMenu(container.querySelector('.topbar')!, { clientX: 40, clientY: 20, shiftKey: true });
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers one show-text toggle on phones that leaves the saved style alone', () => {
    state.mobile = true; state.style = 'icon-top';
    window.localStorage.removeItem('planner.phoneLabels');
    const { container } = renderBar();
    fireEvent.contextMenu(container.querySelector('.topbar')!, { clientX: 40, clientY: 20 });
    expect(screen.queryByRole('menuitemradio', { name: 'Text only' })).toBeNull();
    const toggle = screen.getByRole('menuitemradio', { name: 'Show text' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(container.querySelector('.topbar')).toHaveAttribute('data-phone-labels', 'hidden');
    expect(window.localStorage.getItem('planner.phoneLabels')).toBe('hidden');
    expect(state.mutate).not.toHaveBeenCalled();
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
