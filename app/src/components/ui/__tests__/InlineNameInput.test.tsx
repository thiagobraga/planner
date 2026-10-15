import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineNameInput } from '../InlineNameInput';

describe('InlineNameInput', () => {
  it('opts out of browser autofill', () => {
    render(<InlineNameInput defaultValue="Bugs" onCommit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off');
  });

  it('cancels on Escape by default', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineNameInput defaultValue="Bugs" onCommit={onCommit} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on Escape when commitOnEscape is set', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineNameInput defaultValue="Bugs" commitOnEscape onCommit={onCommit} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCommit).toHaveBeenCalledWith('Bugs');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
