import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../ui/ContextMenu';

const items = [{ type: 'item' as const, label: 'Rename' }];

describe('ContextMenu outside presses', () => {
  it.each([
    ['left', 0],
    ['right', 2],
  ])('closes on a %s press outside, even when the target cancels its mousedown', (_name, button) => {
    const onClose = vi.fn();
    render(
      <>
        <div data-testid="draggable" onPointerDown={(event) => event.preventDefault()} />
        <ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={onClose} />
      </>,
    );
    fireEvent.pointerDown(screen.getByTestId('draggable'), { button });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for presses inside the menu', () => {
    const onClose = vi.fn();
    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Rename' }), { button: 0 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
