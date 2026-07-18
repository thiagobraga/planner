import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateFilter, type EvalTask, type EvalContext } from '../filterEvaluator.js';
import type { FilterExpr } from '../../parsers/filterParser.js';

const COLLECTION_NAMES = ['work', 'home', 'misc'];
const LABEL_NAMES = ['urgent', 'review', 'later'];
const USERS = ['me-id', 'alice', 'bob'];

const arbDate = fc.option(
  fc.tuple(fc.integer({ min: 2024, max: 2025 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
  { nil: null },
);

const arbTask: fc.Arbitrary<EvalTask> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  title: fc.string({ minLength: 0, maxLength: 20 }),
  description: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: null }),
  collectionName: fc.constantFrom(...COLLECTION_NAMES),
  labelNames: fc.subarray(LABEL_NAMES),
  priority: fc.integer({ min: 1, max: 4 }) as fc.Arbitrary<1 | 2 | 3 | 4>,
  dueDate: arbDate,
  assigneeUser: fc.option(fc.constantFrom(...USERS), { nil: null }),
  isCompleted: fc.boolean(),
});

const arbLeaf: fc.Arbitrary<FilterExpr> = fc.oneof(
  fc.constantFrom(...COLLECTION_NAMES).map(name => ({ type: 'collection' as const, name })),
  fc.constantFrom(...LABEL_NAMES).map(name => ({ type: 'label' as const, name })),
  (fc.integer({ min: 1, max: 4 }) as fc.Arbitrary<1 | 2 | 3 | 4>).map(level => ({ type: 'priority' as const, level })),
  fc.constant({ type: 'today' as const }),
  fc.constant({ type: 'overdue' as const }),
  fc.constant({ type: 'noDate' as const }),
  fc.constantFrom(...USERS, 'me').map(user => ({ type: 'assignedTo' as const, user })),
);

const arbExpr: fc.Arbitrary<FilterExpr> = fc.letrec((tie) => ({
  expr: fc.oneof(
    { maxDepth: 3 },
    arbLeaf,
    fc.tuple(tie('expr') as fc.Arbitrary<FilterExpr>, tie('expr') as fc.Arbitrary<FilterExpr>)
      .map(([left, right]) => ({ type: 'and' as const, left, right })),
    fc.tuple(tie('expr') as fc.Arbitrary<FilterExpr>, tie('expr') as fc.Arbitrary<FilterExpr>)
      .map(([left, right]) => ({ type: 'or' as const, left, right })),
    (tie('expr') as fc.Arbitrary<FilterExpr>).map(inner => ({ type: 'not' as const, expr: inner })),
  ),
})).expr;

const ctx: EvalContext = { today: '2024-06-15', currentUser: 'me-id' };

// Tag each task with a unique synthetic id (its index) so set comparisons are unambiguous
function tagWithIndex(tasks: EvalTask[]): EvalTask[] {
  return tasks.map((t, i) => ({ ...t, id: `__idx_${i}` }));
}

describe('Property 22: Filter evaluation correctness (Requirements 16.8)', () => {
  it('and: A & B == intersection of A and B', () => {
    fc.assert(
      fc.property(arbExpr, arbExpr, fc.array(arbTask, { maxLength: 20 }), (left, right, rawTasks) => {
        const tasks = tagWithIndex(rawTasks);
        const andIds = new Set(evaluateFilter({ type: 'and', left, right }, tasks, ctx).map(t => t.id));
        const a = new Set(evaluateFilter(left, tasks, ctx).map(t => t.id));
        const b = new Set(evaluateFilter(right, tasks, ctx).map(t => t.id));
        const intersection = new Set([...a].filter(x => b.has(x)));
        expect(andIds).toEqual(intersection);
      }),
      { numRuns: 100 },
    );
  });

  it('or: A | B == union of A and B', () => {
    fc.assert(
      fc.property(arbExpr, arbExpr, fc.array(arbTask, { maxLength: 20 }), (left, right, rawTasks) => {
        const tasks = tagWithIndex(rawTasks);
        const orIds = new Set(evaluateFilter({ type: 'or', left, right }, tasks, ctx).map(t => t.id));
        const a = new Set(evaluateFilter(left, tasks, ctx).map(t => t.id));
        const b = new Set(evaluateFilter(right, tasks, ctx).map(t => t.id));
        const union = new Set([...a, ...b]);
        expect(orIds).toEqual(union);
      }),
      { numRuns: 100 },
    );
  });

  it('not: !A == complement of A relative to input tasks', () => {
    fc.assert(
      fc.property(arbExpr, fc.array(arbTask, { maxLength: 20 }), (e, rawTasks) => {
        const tasks = tagWithIndex(rawTasks);
        const notIds = new Set(evaluateFilter({ type: 'not', expr: e }, tasks, ctx).map(t => t.id));
        const a = new Set(evaluateFilter(e, tasks, ctx).map(t => t.id));
        const complement = new Set(tasks.map(t => t.id).filter(id => !a.has(id)));
        expect(notIds).toEqual(complement);
      }),
      { numRuns: 100 },
    );
  });

  it('result preserves input order and contains only input tasks', () => {
    fc.assert(
      fc.property(arbExpr, fc.array(arbTask, { maxLength: 20 }), (e, rawTasks) => {
        const tasks = tagWithIndex(rawTasks);
        const result = evaluateFilter(e, tasks, ctx);
        let lastIdx = -1;
        for (const t of result) {
          const idx = tasks.indexOf(t);
          expect(idx).toBeGreaterThan(lastIdx);
          lastIdx = idx;
        }
      }),
      { numRuns: 100 },
    );
  });

  it('double negation: !!A == A', () => {
    fc.assert(
      fc.property(arbExpr, fc.array(arbTask, { maxLength: 20 }), (e, rawTasks) => {
        const tasks = tagWithIndex(rawTasks);
        const direct = evaluateFilter(e, tasks, ctx).map(t => t.id);
        const doubleNeg = evaluateFilter({ type: 'not', expr: { type: 'not', expr: e } }, tasks, ctx).map(t => t.id);
        expect(doubleNeg).toEqual(direct);
      }),
      { numRuns: 100 },
    );
  });
});
