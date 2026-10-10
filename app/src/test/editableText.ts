import { fireEvent } from '@testing-library/react';
import { setCaret } from '../utils/editableText';

/** Replaces the text of a contenteditable field the way typing would, caret at the end. */
export function typeText(el: HTMLElement, text: string): void {
  el.textContent = text;
  setCaret(el, text.length);
  fireEvent.input(el);
}
