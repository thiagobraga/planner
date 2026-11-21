import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import {
  applyOptimistic,
  revertOptimistic,
  upsertById,
  removeById,
  patchById,
  runOptimistic,
} from '../optimistic.js';

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
}

const arbTask: fc.Arbitrary<Task> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  title: fc.string({ minLength: 0, maxLength: 30 }),
  isCompleted: fc.boolean(),
});

describe('optimistic pure helpers', () => {
  it('applyOptimistic returns next and snapshot equals original', () => {
    const state: Task[] = [{ id: 'a', title: 'x', isCompleted: false }];
    const { next, op } = applyOptimistic(state, (s) => patchById(s, 'a', { isCompleted: true }));
    expect(next[0].isCompleted).toBe(true);
    expect(op.snapshot).toBe(state);
  });

  it('revertOptimistic puts back a removed entity at its old position', () => {
    const state: Task[] = [
      { id: 'a', title: 'x', isCompleted: false },
      { id: 'b', title: 'y', isCompleted: false },
    ];
    const { next, op } = applyOptimistic(state, (s) => removeById(s, 'a'));
    expect(revertOptimistic(op, next)).toEqual(state);
  });

  it('revertOptimistic keeps newer edits to other entities and to the same entity', () => {
    const state: Task[] = [
      { id: 'a', title: 'x', isCompleted: false },
      { id: 'b', title: 'y', isCompleted: false },
    ];
    const { next, op } = applyOptimistic(state, (s) => patchById(s, 'a', { isCompleted: true }));
    const otherEdited = patchById(next, 'b', { title: 'renamed' });
    expect(revertOptimistic(op, otherEdited)).toEqual([
      { id: 'a', title: 'x', isCompleted: false },
      { id: 'b', title: 'renamed', isCompleted: false },
    ]);
    const sameEdited = patchById(next, 'a', { title: 'newer' });
    expect(revertOptimistic(op, sameEdited)).toEqual(sameEdited);
  });

  it('revertOptimistic matches by value, so a cache that copied the entity still reverts', () => {
    const state: Task[] = [{ id: 'a', title: 'x', isCompleted: false }];
    const { next, op } = applyOptimistic(state, (s) => patchById(s, 'a', { isCompleted: true }));
    expect(revertOptimistic(op, next.map((t) => ({ ...t })))).toEqual(state);
  });

  it('upsertById updates in place when id matches', () => {
    const state: Task[] = [{ id: 'a', title: 'old', isCompleted: false }];
    const next = upsertById(state, { id: 'a', title: 'new', isCompleted: true });
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe('new');
  });

  it('upsertById appends when id is new', () => {
    const state: Task[] = [{ id: 'a', title: 'old', isCompleted: false }];
    const next = upsertById(state, { id: 'b', title: 'new', isCompleted: false });
    expect(next).toHaveLength(2);
  });
});

describe('Property 27: Optimistic update revert on API failure (Requirements 28.2, 28.3)', () => {
  it('on success: state reflects the optimistic apply', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbTask, { maxLength: 20 }), async (state) => {
        let final: Task[] | undefined;
        const onApply = vi.fn();
        const onRevert = vi.fn();

        await runOptimistic<Task, void>({
          state,
          apply: (s) => patchById(s, s[0]?.id ?? 'noop', { isCompleted: true }),
          call: () => Promise.resolve(),
          onApply: (next) => { onApply(next); final = next; },
          onRevert,
        });

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onRevert).not.toHaveBeenCalled();
        if (state.length > 0) {
          expect(final![0].isCompleted).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('on failure: reverting the untouched optimistic state restores the original', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(arbTask, { selector: (t) => t.id, maxLength: 20 }), async (state) => {
        let applied: Task[] = state;
        let reverted: Task[] | undefined;
        const apiError = new Error('boom');

        try {
          await runOptimistic<Task, void>({
            state,
            apply: (s) => removeById(s, s[0]?.id ?? 'noop'),
            call: () => Promise.reject(apiError),
            onApply: (next) => { applied = next; },
            onRevert: (revert) => { reverted = revert(applied); },
          });
          expect.fail('should reject');
        } catch (e) {
          expect(e).toBe(apiError);
        }
        expect(reverted).toEqual(state);
      }),
      { numRuns: 100 },
    );
  });

  it('never rolls back a slow call that succeeds', async () => {
    vi.useFakeTimers();
    try {
      const onRevert = vi.fn();
      const onSuccess = vi.fn();
      const pending = runOptimistic<Task, string>({
        state: [],
        apply: (s) => s,
        call: () => new Promise((resolve) => setTimeout(() => resolve('saved'), 10_000)),
        onRevert,
        onSuccess,
      });
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pending).resolves.toBe('saved');
      expect(onRevert).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('saved');
    } finally {
      vi.useRealTimers();
    }
  });
});
