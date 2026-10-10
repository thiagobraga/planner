import type { TextRange } from '../types/editableText';

export function getText(el: HTMLElement): string {
  return el.textContent ?? '';
}

/** Caret offsets in characters; collapsed at the end when the selection is outside `el`. */
export function getCaret(el: HTMLElement): TextRange {
  const end = getText(el).length;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { start: end, end };
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return { start: end, end };

  const offsetOf = (node: Node, offset: number) => {
    const before = document.createRange();
    before.selectNodeContents(el);
    before.setEnd(node, offset);
    return before.toString().length;
  };
  return { start: offsetOf(range.startContainer, range.startOffset), end: offsetOf(range.endContainer, range.endOffset) };
}

export function setCaret(el: HTMLElement, start: number, end = start): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const startPoint = locate(el, start);
  const endPoint = locate(el, end);
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Replaces the selected text, as typing or pasting would, and leaves the caret after it. */
export function insertText(el: HTMLElement, text: string): void {
  const { start, end } = getCaret(el);
  const current = getText(el);
  el.textContent = current.slice(0, start) + text + current.slice(end);
  setCaret(el, start + text.length);
}

function locate(el: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (remaining <= node.length) return { node, offset: remaining };
    remaining -= node.length;
    last = node;
  }
  return last ? { node: last, offset: last.length } : { node: el, offset: 0 };
}
