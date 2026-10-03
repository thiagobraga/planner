import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../ui/ContextMenu';

describe('ContextMenu inline panel', () => {
  const items = (onDone: () => void) => [
    {
      type: 'item' as const,
      label: 'Set date',
      panel: (close: () => void) => (
        <button type="button" onClick={() => { onDone(); close(); }}>
          Apply
        </button>
      ),
    },
    { type: 'item' as const, label: 'Delete' },
  ];

  it('opens the panel on click without closing the menu', () => {
    const onClose = vi.fn();
    render(<ContextMenu items={items(vi.fn())} position={{ x: 10, y: 10 }} onClose={onClose} />);

    fireEvent.click(screen.getByText('Set date'));

    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets the panel close the whole menu', () => {
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(<ContextMenu items={items(onDone)} position={{ x: 10, y: 10 }} onClose={onClose} />);

    fireEvent.click(screen.getByText('Set date'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes the panel when hovering another item', () => {
    render(<ContextMenu items={items(vi.fn())} position={{ x: 10, y: 10 }} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Set date'));
    fireEvent.mouseEnter(screen.getByText('Delete').closest('[role="menuitem"]')!);

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });
});
