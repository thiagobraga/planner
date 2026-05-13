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

  it('revertOptimistic returns the snapshot', () => {
    const state: Task[] = [{ id: 'a', title: 'x', isCompleted: false }];
    const { op } = applyOptimistic(state, (s) => removeById(s, 'a'));
    const reverted = revertOptimistic(op);
    expect(reverted).toBe(state);
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
          revertTimeoutMs: 500,
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

  it('on failure: revert is invoked with the original snapshot (reference-equal)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbTask, { maxLength: 20 }), async (state) => {
        let reverted: Task[] | undefined;
        const apiError = new Error('boom');

        try {
          await runOptimistic<Task, void>({
            state,
            apply: (s) => removeById(s, s[0]?.id ?? 'noop'),
            call: () => Promise.reject(apiError),
            onRevert: (snapshot) => { reverted = snapshot; },
            revertTimeoutMs: 500,
          });
          expect.fail('should reject');
        } catch (e) {
          expect(e).toBe(apiError);
        }
        expect(reverted).toBe(state);
      }),
      { numRuns: 100 },
    );
  });

  it('on timeout: reverts within the configured budget', async () => {
    let reverted = false;
    const start = Date.now();

    try {
      await runOptimistic<Task, void>({
        state: [],
        apply: (s) => s,
        call: () => new Promise(() => { /* never resolves */ }),
        onRevert: () => { reverted = true; },
        revertTimeoutMs: 100,
      });
      expect.fail('should reject');
    } catch (e) {
      const elapsed = Date.now() - start;
      expect((e as Error).message).toBe('OPTIMISTIC_TIMEOUT');
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(2000);
    }
    expect(reverted).toBe(true);
  });
});
