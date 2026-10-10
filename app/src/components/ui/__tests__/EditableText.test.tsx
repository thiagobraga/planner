import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableText } from '../EditableText';
import { getCaret, setCaret } from '../../../utils/editableText';
import { typeText } from '../../../test/editableText';

describe('EditableText', () => {
  it('renders a plain-text contenteditable textbox that browsers do not treat as a form field', () => {
    render(<EditableText aria-label="New task…" placeholder="New task…" />);
    const field = screen.getByRole('textbox', { name: 'New task…' });

    expect(field.tagName).toBe('DIV');
    expect(field).toHaveAttribute('contenteditable', 'plaintext-only');
    expect(field).toHaveAttribute('aria-placeholder', 'New task…');
    expect(field).toHaveAttribute('aria-multiline', 'false');
  });

  it('shows the default value of an uncontrolled field', () => {
    render(<EditableText aria-label="Title" defaultValue="Buy milk" />);
    expect(screen.getByRole('textbox')).toHaveTextContent('Buy milk');
  });

  it('follows a controlled value, so clearing it empties the field', () => {
    const { rerender } = render(<EditableText aria-label="Title" value="Buy milk" />);
    expect(screen.getByRole('textbox')).toHaveTextContent('Buy milk');

    rerender(<EditableText aria-label="Title" value="" />);
    expect(screen.getByRole('textbox')).toBeEmptyDOMElement();
  });

  it('reports typed text', () => {
    const onValueChange = vi.fn();
    render(<EditableText aria-label="Title" onValueChange={onValueChange} />);

    typeText(screen.getByRole('textbox'), 'Call mom');

    expect(onValueChange).toHaveBeenCalledWith('Call mom', screen.getByRole('textbox'));
  });

  it('drops the stray line break browsers leave behind so the placeholder shows again', () => {
    render(<EditableText aria-label="Title" />);
    const field = screen.getByRole('textbox');
    field.innerHTML = '<br>';
    fireEvent.input(field);

    expect(field).toBeEmptyDOMElement();
  });

  it('calls onEnter with the text instead of inserting a line break', () => {
    const onEnter = vi.fn();
    render(<EditableText aria-label="Title" defaultValue="Ship it" onEnter={onEnter} />);

    const notPrevented = fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(notPrevented).toBe(false);
    expect(onEnter).toHaveBeenCalledWith('Ship it');
  });

  it('ignores Enter while an IME composition is in progress', () => {
    const onEnter = vi.fn();
    render(<EditableText aria-label="Title" defaultValue="にほん" onEnter={onEnter} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('treats a line break typed without a keydown (some mobile keyboards) as Enter', () => {
    const onEnter = vi.fn();
    render(<EditableText aria-label="Title" defaultValue="Ship it" onEnter={onEnter} />);
    const event = new InputEvent('beforeinput', { inputType: 'insertParagraph', bubbles: true, cancelable: true });

    act(() => {
      screen.getByRole('textbox').dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onEnter).toHaveBeenCalledWith('Ship it');
  });

  it('passes other keys to onKeyDown', () => {
    const onKeyDown = vi.fn();
    render(<EditableText aria-label="Title" onKeyDown={onKeyDown} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: '-' });

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: '-' }));
  });

  it('pastes plain text on one line at the caret', () => {
    const onValueChange = vi.fn();
    render(<EditableText aria-label="Title" defaultValue="Buy  today" onValueChange={onValueChange} />);
    const field = screen.getByRole('textbox');
    setCaret(field, 4);

    fireEvent.paste(field, { clipboardData: { getData: () => 'oat\nmilk' } });

    expect(field).toHaveTextContent('Buy oat milk today');
    expect(onValueChange).toHaveBeenCalledWith('Buy oat milk today', field);
    expect(getCaret(field)).toEqual({ start: 12, end: 12 });
  });

  it('forwards its element through ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<EditableText aria-label="Title" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole('textbox'));
  });
});
