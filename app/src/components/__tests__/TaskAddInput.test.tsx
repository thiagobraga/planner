import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskAddInput } from '../TaskAddInput';

function typeInto(el: HTMLElement, text: string) {
  el.textContent = text;
  fireEvent.input(el);
}

describe('TaskAddInput', () => {
  it('Escape blurs the field and saves a non-empty draft', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<TaskAddInput onCreate={onCreate} />);
    const box = screen.getByRole('textbox');
    box.focus();
    typeInto(box, 'buy milk');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).not.toHaveFocus();
    expect(onCreate).toHaveBeenCalledWith('buy milk');
  });

  it('Escape on an empty field only blurs', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<TaskAddInput onCreate={onCreate} />);
    const box = screen.getByRole('textbox');
    box.focus();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).not.toHaveFocus();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
