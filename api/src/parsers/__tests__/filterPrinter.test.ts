import { describe, it, expect } from 'vitest';
import { printFilter } from '../filterPrinter.js';

describe('filterPrinter', () => {
  it('prints leaf operands', () => {
    expect(printFilter({ type: 'collection', name: 'work' })).toBe('#work');
    expect(printFilter({ type: 'label', name: 'urgent' })).toBe('@urgent');
    expect(printFilter({ type: 'priority', level: 2 })).toBe('p2');
    expect(printFilter({ type: 'today' })).toBe('today');
    expect(printFilter({ type: 'overdue' })).toBe('overdue');
    expect(printFilter({ type: 'noDate' })).toBe('no date');
    expect(printFilter({ type: 'dueOn', date: '2024-06-15' })).toBe('due: 2024-06-15');
    expect(printFilter({ type: 'dueBefore', date: '2024-06-15' })).toBe('due before: 2024-06-15');
    expect(printFilter({ type: 'dueAfter', date: '2024-06-15' })).toBe('due after: 2024-06-15');
    expect(printFilter({ type: 'assignedTo', user: 'me' })).toBe('assigned to: me');
    expect(printFilter({ type: 'assignedTo', user: 'alice' })).toBe('assigned to: alice');
    expect(printFilter({ type: 'text', value: 'hello' })).toBe('"hello"');
  });

  it('escapes quotes and backslashes in text', () => {
    expect(printFilter({ type: 'text', value: 'a "b" c' })).toBe('"a \\"b\\" c"');
    expect(printFilter({ type: 'text', value: 'a \\ b' })).toBe('"a \\\\ b"');
  });

  it('prints binary operators without unnecessary parens', () => {
    expect(printFilter({
      type: 'and',
      left: { type: 'collection', name: 'a' },
      right: { type: 'collection', name: 'b' },
    })).toBe('#a & #b');
  });

  it('parenthesizes lower-precedence left child of and', () => {
    expect(printFilter({
      type: 'and',
      left: { type: 'or', left: { type: 'collection', name: 'a' }, right: { type: 'collection', name: 'b' } },
      right: { type: 'collection', name: 'c' },
    })).toBe('(#a | #b) & #c');
  });

  it('omits parens for same-precedence left of left-assoc', () => {
    expect(printFilter({
      type: 'and',
      left: { type: 'and', left: { type: 'collection', name: 'a' }, right: { type: 'collection', name: 'b' } },
      right: { type: 'collection', name: 'c' },
    })).toBe('#a & #b & #c');
  });

  it('parens for same-precedence right of left-assoc', () => {
    expect(printFilter({
      type: 'and',
      left: { type: 'collection', name: 'a' },
      right: { type: 'and', left: { type: 'collection', name: 'b' }, right: { type: 'collection', name: 'c' } },
    })).toBe('#a & (#b & #c)');
  });

  it('not before atom: no parens', () => {
    expect(printFilter({ type: 'not', expr: { type: 'collection', name: 'a' } })).toBe('!#a');
  });

  it('not before binary: parens', () => {
    expect(printFilter({
      type: 'not',
      expr: { type: 'and', left: { type: 'collection', name: 'a' }, right: { type: 'collection', name: 'b' } },
    })).toBe('!(#a & #b)');
  });
});
