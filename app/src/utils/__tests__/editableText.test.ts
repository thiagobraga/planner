import { afterEach, describe, expect, it } from 'vitest';
import { getCaret, getText, insertText, setCaret } from '../editableText';

function field(...parts: string[]) {
  const el = document.createElement('div');
  for (const part of parts) el.appendChild(document.createTextNode(part));
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('editableText', () => {
  it('reads the text of the field', () => {
    expect(getText(field('Buy ', 'milk'))).toBe('Buy milk');
  });

  it('round-trips a caret range across text nodes', () => {
    const el = field('Buy ', 'milk');
    setCaret(el, 2, 6);
    expect(getCaret(el)).toEqual({ start: 2, end: 6 });
  });

  it('places the caret in an empty field', () => {
    const el = field();
    setCaret(el, 0);
    expect(getCaret(el)).toEqual({ start: 0, end: 0 });
  });

  it('reports the end of the text when the selection is elsewhere', () => {
    const el = field('Buy milk');
    setCaret(field('other'), 1);
    expect(getCaret(el)).toEqual({ start: 8, end: 8 });
  });

  it('inserts text over the selection and moves the caret after it', () => {
    const el = field('Buy cow milk');
    setCaret(el, 4, 7);
    insertText(el, 'oat');
    expect(getText(el)).toBe('Buy oat milk');
    expect(getCaret(el)).toEqual({ start: 7, end: 7 });
  });
});
