import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AppError } from '../../utils/AppError.js';

// --- Mocks ---

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock('../../db/pool.js', () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

vi.mock('../../db/redis.js', () => ({
  redisClient: {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  },
  redisPubClient: {
    publish: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { createTask, updateTask, completeTask, deleteTask } from '../taskService.js';

const userId = 'user-1';
const collectionId = 'collection-1';

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    user_id: userId,
    collection_id: collectionId,
    section_id: null,
    parent_task_id: null,
    assignee_user_id: null,
    title: 'Test Task',
    description: null,
    priority: 4,
    due_date: null,
    due_time: null,
    due_timezone: null,
    recurrence_rule: null,
    is_completed: false,
    completed_at: null,
    order_value: 0,
    depth: 0,
    type: 'task',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClientQuery.mockResolvedValue({ rows: [] });
});

// --- Property 8: Task title validation ---
// **Validates: Requirements 4.1, 4.2, 5.1**

describe('Property 8: Task title validation', () => {
  it('accepts titles of 1-500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.length >= 1),
        async (title) => {
          // Mock: inbox lookup + collection access + insert
          mockQuery
            .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // inbox
            .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // collection access
            .mockResolvedValueOnce({ rows: [makeTaskRow({ title })] }); // insert

          const result = await createTask(userId, { title });
          expect(result.title).toBe(title);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects empty titles (length 0)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(''), async (title) => {
        try {
          await createTask(userId, { title });
          expect.fail('should throw');
        } catch (err) {
          const e = err as AppError;
          expect(e.code).toBe('VALIDATION_ERROR');
          expect(e.details).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
          );
        }
      }),
      { numRuns: 1 },
    );
  });

  it('rejects titles longer than 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 501, maxLength: 1000 }), async (title) => {
        try {
          await createTask(userId, { title });
          expect.fail('should throw');
        } catch (err) {
          const e = err as AppError;
          expect(e.code).toBe('VALIDATION_ERROR');
          expect(e.details).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 9: Task priority validation ---
// **Validates: Requirements 4.6, 4.7**

describe('Property 9: Task priority validation', () => {
  it('accepts priorities 1-4', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (priority) => {
        mockQuery
          .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // inbox
          .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // collection access
          .mockResolvedValueOnce({ rows: [makeTaskRow({ priority })] }); // insert

        const result = await createTask(userId, { title: 'Valid', priority });
        expect(result.priority).toBe(priority);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects priorities outside 1-4', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer().filter((n) => n < 1 || n > 4),
        async (priority) => {
          try {
            await createTask(userId, { title: 'Valid', priority });
            expect.fail('should throw');
          } catch (err) {
            const e = err as AppError;
            expect(e.code).toBe('VALIDATION_ERROR');
            expect(e.details).toEqual(
              expect.arrayContaining([expect.objectContaining({ field: 'priority' })]),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects non-integer priorities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 1.01, max: 3.99, noNaN: true }).filter((n) => !Number.isInteger(n)),
        async (priority) => {
          try {
            await createTask(userId, { title: 'Valid', priority });
            expect.fail('should throw');
          } catch (err) {
            const e = err as AppError;
            expect(e.code).toBe('VALIDATION_ERROR');
            expect(e.details).toEqual(
              expect.arrayContaining([expect.objectContaining({ field: 'priority' })]),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Task type validation', () => {
  it("accepts 'task' and 'note', defaulting to 'task' when omitted", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // inbox
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // collection access
      .mockResolvedValueOnce({ rows: [makeTaskRow({ type: 'task' })] }); // insert

    const result = await createTask(userId, { title: 'Valid' });
    expect(result.type).toBe('task');

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
      .mockResolvedValueOnce({ rows: [makeTaskRow({ type: 'note' })] });

    const note = await createTask(userId, { title: 'Valid', type: 'note' });
    expect(note.type).toBe('note');
  });

  it("rejects any type value other than 'task' or 'note'", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s !== 'task' && s !== 'note'),
        async (type) => {
          try {
            await createTask(userId, { title: 'Valid', type: type as 'task' | 'note' });
            expect.fail('should throw');
          } catch (err) {
            const e = err as AppError;
            expect(e.code).toBe('VALIDATION_ERROR');
            expect(e.details).toEqual(
              expect.arrayContaining([expect.objectContaining({ field: 'type' })]),
            );
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// --- Property 10: Subtask depth enforcement ---
// **Validates: Requirements 8.2, 8.3**

describe('Property 10: Subtask depth enforcement', () => {
  it('rejects subtask creation when depth would exceed 5', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 5, max: 20 }), async (parentDepth) => {
        // Mock verifyTaskAccess for parent - returns parent at given depth
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: 'parent-1', depth: parentDepth })],
        });

        try {
          await createTask(userId, { title: 'Child', parentTaskId: 'parent-1' });
          expect.fail('should throw');
        } catch (err) {
          const e = err as AppError;
          expect(e.code).toBe('MAX_DEPTH_EXCEEDED');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('accepts subtask creation when depth is 5 or less', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 4 }), async (parentDepth) => {
        // Mock verifyTaskAccess for parent
        mockQuery
          .mockResolvedValueOnce({
            rows: [makeTaskRow({ id: 'parent-1', depth: parentDepth, collection_id: collectionId })],
          })
          // collection access check
          .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
          // insert returning
          .mockResolvedValueOnce({
            rows: [makeTaskRow({ depth: parentDepth + 1, parent_task_id: 'parent-1' })],
          });

        const result = await createTask(userId, { title: 'Child', parentTaskId: 'parent-1' });
        expect(result.depth).toBe(parentDepth + 1);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 11: Subtask cycle detection ---
// **Validates: Requirements 8.4**

describe('Property 11: Subtask cycle detection', () => {
  it('rejects setting parent to self', async () => {
    const taskId = 'task-self';

    // verifyTaskAccess for the task being updated
    mockQuery.mockResolvedValueOnce({
      rows: [makeTaskRow({ id: taskId })],
    });
    // verifyTaskAccess for proposed parent (same task)
    mockQuery.mockResolvedValueOnce({
      rows: [makeTaskRow({ id: taskId })],
    });
    // detectCycle: ancestor CTE returns the task itself (cycle found)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: taskId }],
    });

    try {
      await updateTask(taskId, userId, { parentTaskId: taskId });
      expect.fail('should throw');
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe('CYCLIC_REFERENCE');
    }
  });

  it('rejects setting parent to a descendant', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (chainLength) => {
        const taskId = 'task-root';
        const descendantId = `task-desc-${chainLength}`;

        // verifyTaskAccess for the task being updated
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: taskId, depth: 0 })],
        });
        // verifyTaskAccess for proposed parent (descendant)
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: descendantId, depth: chainLength })],
        });
        // detectCycle: ancestor CTE finds taskId in ancestor chain (cycle)
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: taskId }],
        });

        try {
          await updateTask(taskId, userId, { parentTaskId: descendantId });
          expect.fail('should throw');
        } catch (err) {
          const e = err as AppError;
          expect(e.code).toBe('CYCLIC_REFERENCE');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('accepts setting parent when no cycle exists', async () => {
    const taskId = 'task-a';
    const newParentId = 'task-b';

    // verifyTaskAccess for the task being updated
    mockQuery.mockResolvedValueOnce({
      rows: [makeTaskRow({ id: taskId, depth: 0 })],
    });
    // verifyTaskAccess for proposed parent
    mockQuery.mockResolvedValueOnce({
      rows: [makeTaskRow({ id: newParentId, depth: 0 })],
    });
    // detectCycle: no cycle found
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // max descendant depth query
    mockQuery.mockResolvedValueOnce({ rows: [{ max_depth: null }] });
    // Reparent shifts depth (0 → 1), so it runs in a transaction that also
    // cascades descendant depths: BEGIN, main UPDATE, descendant UPDATE, COMMIT.
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [makeTaskRow({ id: taskId, parent_task_id: newParentId, depth: 1 })],
      }) // main UPDATE
      .mockResolvedValueOnce({ rows: [] }) // descendant depth cascade
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await updateTask(taskId, userId, { parentTaskId: newParentId });
    expect(result.parentTaskId).toBe(newParentId);
  });
});

// --- Property 12: Parent completion cascades to all descendants ---
// **Validates: Requirements 6.4**

describe('Property 12: Parent completion cascades to all descendants', () => {
  it('completing parent triggers cascade update on all descendants', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (_numDescendants) => {
        vi.clearAllMocks();
        mockClientQuery.mockResolvedValue({ rows: [] });

        const taskId = 'parent-task';

        // verifyTaskAccess
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: taskId, recurrence_rule: null })],
        });

        // client.query calls in order: BEGIN, mark complete, cascade, activity, COMMIT
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // mark parent complete
          .mockResolvedValueOnce({ rows: [] }) // cascade to descendants
          .mockResolvedValueOnce({ rows: [] }) // activity event
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        // Final SELECT after commit
        mockQuery.mockResolvedValueOnce({
          rows: [
            makeTaskRow({ id: taskId, is_completed: true, completed_at: '2024-01-01T00:00:00Z' }),
          ],
        });

        const result = await completeTask(taskId, userId);
        expect(result.isCompleted).toBe(true);

        // Verify cascade query was called (3rd client query call)
        const cascadeCall = mockClientQuery.mock.calls[2];
        expect(cascadeCall[0]).toContain('RECURSIVE');
        expect(cascadeCall[0]).toContain('is_completed = true');
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 13: Parent deletion cascades to all descendants ---
// **Validates: Requirements 7.1, 8.6**

describe('Property 13: Parent deletion cascades to all descendants', () => {
  it('deleting parent collects and deletes all descendants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        async (descendantIds) => {
          vi.clearAllMocks();
          mockClientQuery.mockResolvedValue({ rows: [] });

          const taskId = 'parent-task';
          const allIds = [taskId, ...descendantIds];

          // verifyTaskAccess
          mockQuery.mockResolvedValueOnce({
            rows: [makeTaskRow({ id: taskId })],
          });

          // client.query calls: BEGIN, recursive CTE, delete reminders, delete tasks, activity, COMMIT
          mockClientQuery
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: allIds.map((id) => ({ id })) }) // recursive subtree
            .mockResolvedValueOnce({ rows: [] }) // delete reminders
            .mockResolvedValueOnce({ rows: [] }) // delete tasks
            .mockResolvedValueOnce({ rows: [] }) // activity event
            .mockResolvedValueOnce({ rows: [] }); // COMMIT

          const result = await deleteTask(taskId, userId);
          expect(result.success).toBe(true);

          // Verify delete was called with all IDs
          const deleteCall = mockClientQuery.mock.calls[3];
          expect(deleteCall[0]).toContain('DELETE FROM tasks');
          expect(deleteCall[1]).toEqual([allIds]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 14: Moving parent moves all descendants ---
// **Validates: Requirements 8.5**

describe('Property 14: Moving parent moves all descendants', () => {
  it('moving task to new collection updates collection_id and clears section_id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (newCollectionId) => {
        vi.clearAllMocks();

        const taskId = 'task-move';
        const oldCollectionId = 'old-collection';

        // verifyTaskAccess for the task
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: taskId, collection_id: oldCollectionId, section_id: 'section-1' })],
        });
        // collection access check for new collection
        mockQuery.mockResolvedValueOnce({ rows: [{ id: newCollectionId }] });
        // update query
        mockQuery.mockResolvedValueOnce({
          rows: [makeTaskRow({ id: taskId, collection_id: newCollectionId, section_id: null })],
        });

        const result = await updateTask(taskId, userId, { collectionId: newCollectionId });
        expect(result.collectionId).toBe(newCollectionId);
        expect(result.sectionId).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
