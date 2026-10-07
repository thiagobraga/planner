import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineNameInput } from '../InlineNameInput';

describe('InlineNameInput', () => {
  it('opts out of browser autofill', () => {
    render(<InlineNameInput defaultValue="Bugs" onCommit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off');
  });
});
