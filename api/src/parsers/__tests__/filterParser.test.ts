import { describe, it, expect } from 'vitest';
import { parseFilter } from '../filterParser.js';

describe('filterParser', () => {
  describe('operands', () => {
    it('parses collection', () => {
      expect(parseFilter('#work')).toEqual({ type: 'collection', name: 'work' });
    });

    it('parses label', () => {
      expect(parseFilter('@urgent')).toEqual({ type: 'label', name: 'urgent' });
    });

    it('parses priority levels p1-p4', () => {
      expect(parseFilter('p1')).toEqual({ type: 'priority', level: 1 });
      expect(parseFilter('p4')).toEqual({ type: 'priority', level: 4 });
    });

    it('parses today/overdue/no date', () => {
      expect(parseFilter('today')).toEqual({ type: 'today' });
      expect(parseFilter('overdue')).toEqual({ type: 'overdue' });
      expect(parseFilter('no date')).toEqual({ type: 'noDate' });
    });

    it('parses due date variants', () => {
      expect(parseFilter('due: 2024-06-15')).toEqual({ type: 'dueOn', date: '2024-06-15' });
      expect(parseFilter('due before: 2024-06-15')).toEqual({ type: 'dueBefore', date: '2024-06-15' });
      expect(parseFilter('due after: 2024-06-15')).toEqual({ type: 'dueAfter', date: '2024-06-15' });
    });

    it('parses assigned to me/user', () => {
      expect(parseFilter('assigned to: me')).toEqual({ type: 'assignedTo', user: 'me' });
      expect(parseFilter('assigned to: alice')).toEqual({ type: 'assignedTo', user: 'alice' });
    });

    it('parses quoted text', () => {
      expect(parseFilter('"hello world"')).toEqual({ type: 'text', value: 'hello world' });
    });

    it('handles escaped quotes/backslash in text', () => {
      expect(parseFilter('"a \\"b\\" c"')).toEqual({ type: 'text', value: 'a "b" c' });
      expect(parseFilter('"a \\\\ b"')).toEqual({ type: 'text', value: 'a \\ b' });
    });
  });

  describe('operators and precedence', () => {
    it('parses and: a & b', () => {
      expect(parseFilter('#a & #b')).toEqual({
        type: 'and',
        left: { type: 'collection', name: 'a' },
        right: { type: 'collection', name: 'b' },
      });
    });

    it('parses or: a | b', () => {
      expect(parseFilter('#a | #b')).toEqual({
        type: 'or',
        left: { type: 'collection', name: 'a' },
        right: { type: 'collection', name: 'b' },
      });
    });

    it('parses not: !a', () => {
      expect(parseFilter('!#a')).toEqual({ type: 'not', expr: { type: 'collection', name: 'a' } });
    });

    it('and binds tighter than or: a | b & c', () => {
      expect(parseFilter('#a | #b & #c')).toEqual({
        type: 'or',
        left: { type: 'collection', name: 'a' },
        right: {
          type: 'and',
          left: { type: 'collection', name: 'b' },
          right: { type: 'collection', name: 'c' },
        },
      });
    });

    it('parentheses override precedence', () => {
      expect(parseFilter('(#a | #b) & #c')).toEqual({
        type: 'and',
        left: {
          type: 'or',
          left: { type: 'collection', name: 'a' },
          right: { type: 'collection', name: 'b' },
        },
        right: { type: 'collection', name: 'c' },
      });
    });

    it('and/or are left-associative', () => {
      expect(parseFilter('#a & #b & #c')).toEqual({
        type: 'and',
        left: {
          type: 'and',
          left: { type: 'collection', name: 'a' },
          right: { type: 'collection', name: 'b' },
        },
        right: { type: 'collection', name: 'c' },
      });
    });
  });

  describe('errors', () => {
    it('rejects empty input', () => {
      expect(() => parseFilter('')).toThrow();
      expect(() => parseFilter('   ')).toThrow();
    });

    it('reports parse error with position', () => {
      try {
        parseFilter('#a & &');
        expect.fail('should have thrown');
      } catch (e) {
        const err = e as Error & { position: number };
        expect(err.message).toMatch(/position/);
        expect(typeof err.position).toBe('number');
      }
    });
  });
});
