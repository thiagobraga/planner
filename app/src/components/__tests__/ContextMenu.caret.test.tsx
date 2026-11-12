import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '../ui/ContextMenu';

const items = [{ type: 'item' as const, label: 'Complete' }];

describe('ContextMenu caret', () => {
  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows one upward caret behind the highlighted first item', () => {
    render(<ContextMenu items={items} position={{ x: 100, y: 100 }} caret onClose={vi.fn()} />);

    const caret = document.querySelector('.ui-context-menu-caret');
    const item = screen.getByRole('menuitem', { name: 'Complete' });
    expect(caret).toHaveClass('border-t', 'border-l');
    expect(caret).toHaveClass('z-0');
    expect(item).toHaveClass('relative', 'z-10');
    expect(document.querySelectorAll('.ui-context-menu-caret')).toHaveLength(1);
  });

  it('can omit the caret for an empty-space menu', () => {
    render(<ContextMenu items={items} position={{ x: 100, y: 100 }} caret={false} onClose={vi.fn()} />);
    expect(document.querySelector('.ui-context-menu-caret')).toBeNull();
  });

  it('points down when the menu opens above its origin', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 180, height: 100, top: 0, left: 0, right: 180, bottom: 100,
      x: 0, y: 0, toJSON: () => ({}),
    });
    render(<ContextMenu items={items} position={{ x: 100, y: 700 }} caret onClose={vi.fn()} />);
    expect(document.querySelector('.ui-context-menu-caret')).toHaveClass('border-b', 'border-r');
  });

  it('keeps a long task menu above the mobile bottom bar', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(845);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const isBar = this.classList.contains('bottom-bar');
      const height = isBar ? 60 : 300;
      const top = isBar ? 785 : 0;
      return { width: 180, height, top, left: 0, right: 180, bottom: top + height, x: 0, y: top, toJSON: () => ({}) };
    });
    render(
      <div className="app-shell app-shell--bottom-bar">
        <nav className="bottom-bar" />
        <ContextMenu items={items} position={{ x: 20, y: 700 }} onClose={vi.fn()} />
      </div>,
    );
    const menu = document.querySelector('.ui-context-menu-panel') as HTMLElement;
    expect(Number.parseFloat(menu.style.top) + 300).toBeLessThanOrEqual(777);
    expect(menu.style.maxHeight).toBe('769px');
  });
});
