import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ContextMenu } from '../ui/ContextMenu';

describe('ContextMenu navigation options', () => {
  it('shows shortcuts beside action labels without changing ordinary item semantics', () => {
    const items = [
      { type: 'item' as const, label: 'Settings', shortcut: 'g s' },
      { type: 'item' as const, label: 'Help' },
    ];

    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={vi.fn()} />);

    const settings = screen.getByRole('menuitem', { name: /Settings/ });
    expect(within(settings).getByText('g s')).toBeInTheDocument();
    expect(settings).not.toHaveAttribute('aria-checked');
    expect(screen.getByRole('menuitem', { name: 'Help' })).toBeInTheDocument();
  });

  it('exposes both selected and unselected style options as radio menu items', () => {
    const items = [
      { type: 'item' as const, label: 'Text only', checked: false },
      { type: 'item' as const, label: 'Icon left', checked: true },
    ];

    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={vi.fn()} />);

    expect(screen.getByRole('menuitemradio', { name: 'Text only', checked: false })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Icon left', checked: true })).toBeInTheDocument();
  });

  it('activates a radio option with the keyboard and dismisses the menu', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const items = [
      { type: 'item' as const, label: 'Text only', checked: false, onClick: onSelect },
      { type: 'item' as const, label: 'Icon left', checked: true },
    ];

    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={onClose} />);
    expect(screen.getByRole('menuitemradio', { name: 'Text only' })).toBeInTheDocument();
    expect(screen.getByRole('menu')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves past disabled options and separators from the initial focus', () => {
    const onSelect = vi.fn();
    render(<ContextMenu items={[
      { type: 'item', label: 'First' },
      { type: 'separator' },
      { type: 'item', label: 'Disabled', disabled: true },
      { type: 'item', label: 'Last', onClick: onSelect },
    ]} position={{ x: 10, y: 10 }} onClose={vi.fn()} />);

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it.each([false, true])('dismisses on Tab with shiftKey=%s', (shiftKey) => {
    const onClose = vi.fn();
    render(<ContextMenu items={[{ type: 'item', label: 'Settings' }]}
      position={{ x: 10, y: 10 }} onClose={onClose} />);

    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('returns keyboard focus to the parent menu after Escape closes a submenu', () => {
    const onClose = vi.fn();
    render(<ContextMenu items={[{
      type: 'item', label: 'Settings', submenu: [{ type: 'item', label: 'General' }],
    }]} position={{ x: 10, y: 10 }} onClose={onClose} />);

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(screen.getAllByRole('menu')[1]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByRole('menu')).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });
});
