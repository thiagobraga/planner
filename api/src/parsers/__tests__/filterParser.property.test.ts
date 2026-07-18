import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseFilter, type FilterExpr } from '../filterParser.js';
import { printFilter } from '../filterPrinter.js';

const arbIdent = fc.stringMatching(/^[a-zA-Z0-9_]{1,20}$/);
const arbPriorityLevel = fc.integer({ min: 1, max: 4 }) as fc.Arbitrary<1 | 2 | 3 | 4>;
const arbISODate = fc.tuple(
  fc.integer({ min: 2000, max: 2099 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

// Text values: any printable ASCII except control chars; quotes/backslash get escaped in printer
const arbText = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[\x20-\x7E]+$/.test(s));

const arbLeaf: fc.Arbitrary<FilterExpr> = fc.oneof(
  arbIdent.map(name => ({ type: 'collection' as const, name })),
  arbIdent.map(name => ({ type: 'label' as const, name })),
  arbPriorityLevel.map(level => ({ type: 'priority' as const, level })),
  fc.constant({ type: 'today' as const }),
  fc.constant({ type: 'overdue' as const }),
  fc.constant({ type: 'noDate' as const }),
  arbISODate.map(date => ({ type: 'dueOn' as const, date })),
  arbISODate.map(date => ({ type: 'dueBefore' as const, date })),
  arbISODate.map(date => ({ type: 'dueAfter' as const, date })),
  fc.oneof(fc.constant('me'), arbIdent).map(user => ({ type: 'assignedTo' as const, user })),
  arbText.map(value => ({ type: 'text' as const, value })),
);

const arbExpr: fc.Arbitrary<FilterExpr> = fc.letrec((tie) => ({
  expr: fc.oneof(
    { maxDepth: 4 },
    arbLeaf,
    fc.tuple(tie('expr') as fc.Arbitrary<FilterExpr>, tie('expr') as fc.Arbitrary<FilterExpr>)
      .map(([left, right]) => ({ type: 'and' as const, left, right })),
    fc.tuple(tie('expr') as fc.Arbitrary<FilterExpr>, tie('expr') as fc.Arbitrary<FilterExpr>)
      .map(([left, right]) => ({ type: 'or' as const, left, right })),
    (tie('expr') as fc.Arbitrary<FilterExpr>).map(inner => ({ type: 'not' as const, expr: inner })),
  ),
})).expr;

describe('Property 2: Filter parser round-trip (Requirements 16.6, 16.7)', () => {
  it('parse(print(e)) === e for arbitrary FilterExpr', () => {
    fc.assert(
      fc.property(arbExpr, (expr) => {
        const printed = printFilter(expr);
        const parsed = parseFilter(printed);
        expect(parsed).toEqual(expr);
      }),
      { numRuns: 200 },
    );
  });
});
