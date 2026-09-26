import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ViewSwitcher } from '../ViewSwitcher';

describe('ViewSwitcher', () => {
  it('renders the four view buttons as a group, in order', () => {
    render(<ViewSwitcher view="list" onViewChange={vi.fn()} />);
    const group = screen.getByRole('group');
    expect(Array.from(group.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      'List',
      'Kanban lists',
      'Kanban cards',
      'Calendar',
    ]);
  });

  it('marks only the active view as pressed', () => {
    render(<ViewSwitcher view="kanban" onViewChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Kanban cards' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['List', 'Kanban lists', 'Calendar']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it.each([
    ['List', 'list'],
    ['Kanban lists', 'kanban-list'],
    ['Kanban cards', 'kanban'],
    ['Calendar', 'calendar'],
  ])('clicking %s calls onViewChange with %s', (name, value) => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher view="list" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(onViewChange).toHaveBeenCalledWith(value);
  });

  it('renders separate 24px buttons, dark only when active', () => {
    render(<ViewSwitcher view="calendar" onViewChange={vi.fn()} />);
    const active = screen.getByRole('button', { name: 'Calendar' });
    const idle = screen.getByRole('button', { name: 'List' });
    expect(active).toHaveClass('w-6', 'h-6', 'bg-ink', 'text-cream');
    expect(idle).toHaveClass('w-6', 'h-6', 'text-ink-light');
    expect(idle).not.toHaveClass('bg-ink');
  });
});
