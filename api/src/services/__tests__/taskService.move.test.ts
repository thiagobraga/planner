import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/pool.js", () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: { subscribe: vi.fn().mockResolvedValue(undefined) },
}));

import { moveTask } from "../taskService.js";
import { AppError } from "../../utils/AppError.js";
import pool from "../../db/pool.js";

const userId = "user-1";
const collectionId = "collection-1";
const taskId = "task-1";

function taskRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: taskId,
    user_id: userId,
    collection_id: collectionId,
    section_id: null,
    parent_task_id: null,
    assignee_user_id: null,
    title: "Test Task",
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
    type: "task",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

/**
 * Records every statement the transaction issues, so a test can assert what the
 * move actually wrote rather than only what it returned. `rowsFor` lets a test
 * answer specific SELECTs by matching on the SQL text - the move issues them in
 * a fixed order, but matching on text keeps the tests readable and stops an
 * added query from shifting every index.
 */
function mockTransaction(rowsFor: Array<[RegExp, unknown[]]> = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [pattern, rows] of rowsFor) {
      if (pattern.test(sql)) return { rows };
    }
    return { rows: [] };
  });
  const release = vi.fn();
  (pool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({ query, release });
  return { calls, query, release };
}

const scopeCollection = { kind: "collection" as const, collectionId };

/**
 * AppError keeps its top-level message generic ("Validation failed") and puts
 * the specific reason in `details`, so assert there rather than on `message`.
 */
async function expectRejection(
  promise: Promise<unknown>,
  field: string,
  message: RegExp,
): Promise<void> {
  await expect(promise).rejects.toThrow(AppError);
  const err = await promise.catch((e: AppError) => e);
  const details = (err as AppError & { details?: Array<{ field: string; message: string }> }).details;
  expect(details?.[0]?.field).toBe(field);
  expect(details?.[0]?.message).toMatch(message);
}

beforeEach(() => {
  (pool.query as ReturnType<typeof vi.fn>).mockReset();
  (pool.connect as ReturnType<typeof vi.fn>).mockReset();
});

describe("moveTask validation", () => {
  it.each([
    ["a negative position", { parentTaskId: null, scope: scopeCollection, position: -1 }],
    ["a fractional position", { parentTaskId: null, scope: scopeCollection, position: 1.5 }],
    ["a malformed due date", { parentTaskId: null, scope: scopeCollection, position: 0, dueDate: "07/18/2026" }],
    ["an unknown scope kind", { parentTaskId: null, scope: { kind: "week" }, position: 0 }],
    ["a day scope without a valid date", { parentTaskId: null, scope: { kind: "day", dueDate: "nope" }, position: 0 }],
  ])("rejects %s", async (_label, input) => {
    await expect(
      moveTask(taskId, userId, input as Parameters<typeof moveTask>[2]),
    ).rejects.toThrow(AppError);
    // Rejected before any connection is taken - nothing can have been written.
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("validates before authenticating, so a bad body never probes task existence", async () => {
    await expect(
      moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: -1 }),
    ).rejects.toThrow(AppError);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("moveTask structural rules", () => {
  it("rejects making a task its own parent", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    mockTransaction([[/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0 }]]]);

    await expectRejection(
      moveTask(taskId, userId, { parentTaskId: taskId, scope: scopeCollection, position: 0 }),
      "parentTaskId",
      /cannot be its own parent/,
    );
  });

  it("rejects dropping a task inside its own subtree", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    mockTransaction([
      [
        /WITH RECURSIVE/,
        [
          { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
          { id: "child-1", parent_task_id: taskId, depth: 1, collection_id: collectionId, section_id: null, due_date: null },
        ],
      ],
    ]);

    await expectRejection(
      moveTask(taskId, userId, { parentTaskId: "child-1", scope: scopeCollection, position: 0 }),
      "parentTaskId",
      /inside its own subtree/,
    );
  });

  it("rejects a move that would nest deeper than 5 levels", async () => {
    // Dragged root sits at depth 0 with a child at depth 1; target parent is at
    // depth 4, so the child would land at depth 6.
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow({ depth: 0 })] })
      .mockResolvedValueOnce({ rows: [taskRow({ id: "deep-parent", depth: 4 })] });
    mockTransaction([
      [
        /WITH RECURSIVE/,
        [
          { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
          { id: "child-1", parent_task_id: taskId, depth: 1, collection_id: collectionId, section_id: null, due_date: null },
        ],
      ],
    ]);

    await expectRejection(
      moveTask(taskId, userId, { parentTaskId: "deep-parent", scope: scopeCollection, position: 0 }),
      "parentTaskId",
      /deeper than 5 levels/,
    );
  });

  it("rejects a move into a collection the user cannot reach", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      // The dragged task resolves; the target collection does not.
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValue({ rows: [] });
    mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
    ]);

    await expect(
      moveTask(taskId, userId, {
        parentTaskId: null,
        collectionId: "someone-elses-collection",
        scope: { kind: "collection", collectionId: "someone-elses-collection" },
        position: 0,
      }),
    ).rejects.toThrow(AppError);
  });

  it("rejects a move when access to the current destination collection was revoked", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      // The task remains reachable through its user_id, but collection access is gone.
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [] });
    const tx = mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
    ]);

    await expect(
      moveTask(taskId, userId, {
        parentTaskId: null,
        scope: scopeCollection,
        position: 0,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT id FROM collections"),
      [collectionId, userId],
    );
    expect(tx.calls.some((call) => /UPDATE tasks/.test(call.sql))).toBe(false);
  });

  it("rejects a move under a parent the user cannot reach", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValue({ rows: [] });
    mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
    ]);

    await expect(
      moveTask(taskId, userId, {
        parentTaskId: "someone-elses-task",
        scope: scopeCollection,
        position: 0,
      }),
    ).rejects.toThrow(AppError);
  });

  it("rolls back and releases the connection when a statement fails", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (/UPDATE tasks/.test(sql)) throw new Error("constraint violation");
      if (/WITH RECURSIVE/.test(sql)) {
        return { rows: [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }] };
      }
      return { rows: [] };
    });
    (pool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({ query, release });

    await expect(
      moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 0 }),
    ).rejects.toThrow("constraint violation");

    const issued = query.mock.calls.map((c) => c[0] as string);
    expect(issued).toContain("ROLLBACK");
    expect(issued).not.toContain("COMMIT");
    expect(release).toHaveBeenCalled();
  });
});

describe("moveTask ordering scopes", () => {
  function stubSuccessfulMove(rowsFor: Array<[RegExp, unknown[]]>) {
    const tx = mockTransaction(rowsFor);
    // Post-commit reads: moved subtree, then affected siblings.
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    return tx;
  }

  it("writes a single midpoint order value between the flanking siblings", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
      [/SELECT id, order_value, due_date FROM tasks/, [
        { id: "sib-a", order_value: 0, due_date: null },
        { id: "sib-b", order_value: 1000, due_date: null },
      ]],
    ]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 1 });

    const orderWrites = tx.calls
      .filter((c) => /SET order_value/.test(c.sql))
      .map((c) => c.params);
    // Dragged task requested index 1, between sib-a (0) and sib-b (1000): only
    // the moved task is written, at their midpoint.
    expect(orderWrites).toEqual([[500, taskId]]);
  });

  it("clamps a position past the end of the list to a single append write", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
      [/SELECT id, order_value, due_date FROM tasks/, [{ id: "sib-a", order_value: 0, due_date: null }]],
    ]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 99 });

    const orderWrites = tx.calls.filter((c) => /SET order_value/.test(c.sql)).map((c) => c.params);
    // No sibling after the append slot, so the moved task lands 1000 past
    // sib-a; sib-a itself is never rewritten.
    expect(orderWrites).toEqual([[1000, taskId]]);
  });

  it("falls back to a full renumber when the target siblings' order values collide", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
      // sib-a and sib-b sit at adjacent values - no integer room between them.
      [/SELECT id, order_value, due_date FROM tasks/, [
        { id: "sib-a", order_value: 0, due_date: null },
        { id: "sib-b", order_value: 1, due_date: null },
      ]],
    ]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 1 });

    const orderWrites = tx.calls.filter((c) => /SET order_value/.test(c.sql)).map((c) => c.params);
    expect(orderWrites).toEqual([
      [0, "sib-a"],
      [1000, taskId],
      [2000, "sib-b"],
    ]);
  });

  it("falls back to seeding the whole day when a target-position neighbor is unseeded", async () => {
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: "2026-07-18" }]],
      // The day's current order is read from tasks joined to task_order, so a
      // task that has never been dragged in Daily is seeded alongside those
      // that have. Neither row here carries a `position` - both unseeded.
      // `order_value` is deliberately distinct from the day positions the
      // fallback is about to write (0/1000/2000), so a reported orderValue
      // would fail this test if it ever leaked the day position instead.
      [/LEFT JOIN task_order/, [
        { task_id: "other-1", collection_id: collectionId, parent_task_id: null, depth: 0, order_value: 5000 },
        { task_id: "other-2", collection_id: collectionId, parent_task_id: null, depth: 0, order_value: 9000 },
      ]],
    ]);
    // The moved task's own order_value (untouched by a day-scope move) must
    // also differ from the day position (0) it is about to be seeded at.
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18", order_value: 47000 })],
    });

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      scope: { kind: "day", dueDate: "2026-07-18" },
      position: 0,
    });

    const dayWrites = tx.calls.filter((c) => /INSERT INTO task_order/.test(c.sql)).map((c) => c.params);
    expect(dayWrites).toEqual([
      [userId, taskId, "2026-07-18", 0],
      [userId, "other-1", "2026-07-18", 1000],
      [userId, "other-2", "2026-07-18", 2000],
    ]);
    // The whole point of the separate table: a Daily drag must not renumber the
    // collection's ordering.
    expect(tx.calls.some((c) => /SET order_value/.test(c.sql))).toBe(false);

    // `orderValue` in the response reports the effective day position so
    // DailyPage preserves the newly reordered state without snapping back.
    expect(result.reordered.map((r) => ({ id: r.id, orderValue: r.orderValue }))).toEqual([
      { id: taskId, orderValue: 0 },
      { id: "other-1", orderValue: 1000 },
      { id: "other-2", orderValue: 2000 },
    ]);
  });

  it("writes a single midpoint day position when both neighbors are already seeded", async () => {
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: "2026-07-18" }]],
      // Both neighbors already carry a real task_order position.
      [/LEFT JOIN task_order/, [
        { task_id: "other-1", position: 0 },
        { task_id: "other-2", position: 1000 },
      ]],
    ]);
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18", order_value: 47000 })],
    });

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      scope: { kind: "day", dueDate: "2026-07-18" },
      position: 1,
    });

    const dayWrites = tx.calls.filter((c) => /INSERT INTO task_order/.test(c.sql)).map((c) => c.params);
    // Between other-1 (0) and other-2 (1000): only the moved task is written.
    expect(dayWrites).toEqual([[userId, taskId, "2026-07-18", 500]]);
    expect(tx.calls.some((c) => /SET order_value/.test(c.sql))).toBe(false);

    // The reported orderValue is the day position (500) just written.
    expect(result.reordered).toEqual([
      {
        id: taskId,
        parentTaskId: null,
        collectionId,
        dueDate: "2026-07-18",
        orderValue: 500,
        depth: 0,
      },
    ]);
  });

  it("reports the day position, not the untouched collection order_value, in `moved`", async () => {
    // A day-scoped move never writes `tasks.order_value` - it stays at
    // whatever the collection last set it to (47000 here, deliberately unlike
    // the day position). The client applies `moved` as the authoritative
    // patch after a drag; if it reported the raw column, every day-scoped
    // move would hand the client `orderValue: 47000` (or, for a task that has
    // never had a collection order written, literally `0`) and the row would
    // snap back to the front of the list the instant that "authoritative"
    // patch lands - the optimistic reorder was correct, the patch undid it.
    const tx = mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: "2026-07-18" }]],
      [/LEFT JOIN task_order/, [
        { task_id: "other-1", position: 0 },
        { task_id: "other-2", position: 1000 },
      ]],
    ]);
    (pool.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      // The post-commit subtree read joins `task_order` to recover the day
      // position for whichever tasks moved; simulate that join's result.
      if (/LEFT JOIN task_order/.test(sql)) {
        return { rows: [taskRow({ due_date: "2026-07-18", order_value: 47000, day_position: 500 })] };
      }
      return { rows: [taskRow({ due_date: "2026-07-18", order_value: 47000 })] };
    });

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      scope: { kind: "day", dueDate: "2026-07-18" },
      position: 1,
    });

    void tx;
    expect(result.moved).toEqual([
      {
        id: taskId,
        parentTaskId: null,
        collectionId,
        dueDate: "2026-07-18",
        orderValue: 500,
        depth: 0,
      },
    ]);
  });
});

describe("moveTask onto a sidebar collection", () => {
  const inboxId = "inbox-collection";

  it("promotes a dated subtask to the top of Inbox while keeping its due date", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      // The dragged task: a depth-1 subtask, dated, in another collection.
      .mockResolvedValueOnce({
        rows: [taskRow({ depth: 1, parent_task_id: "parent-1", due_date: "2026-07-18" })],
      })
      // Inbox resolves as an accessible collection.
      .mockResolvedValueOnce({ rows: [{ id: inboxId }] })
      // The moved records the response reports back, then the reordered siblings.
      .mockResolvedValueOnce({
        rows: [taskRow({ collection_id: inboxId, depth: 0, parent_task_id: null, due_date: "2026-07-18" })],
      })
      .mockResolvedValue({ rows: [] });

    const tx = mockTransaction([
      [
        /WITH RECURSIVE/,
        [{ id: taskId, parent_task_id: "parent-1", depth: 1, collection_id: collectionId, section_id: null, due_date: "2026-07-18" }],
      ],
    ]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      collectionId: inboxId,
      scope: { kind: "collection", collectionId: inboxId },
      // The client appends; the server clamps to the end of the list.
      position: Number.MAX_SAFE_INTEGER,
    });

    const rootWrite = tx.calls.find((c) => /UPDATE tasks\s+SET parent_task_id/.test(c.sql));
    expect(rootWrite).toBeDefined();
    const [parentTaskId, destCollectionId, , dueDate, depth] = rootWrite!.params as unknown[];

    // Detached from its old parent and promoted to the root of Inbox...
    expect(parentTaskId).toBeNull();
    expect(destCollectionId).toBe(inboxId);
    expect(depth).toBe(0);
    // ...but still sitting on the day it was already scheduled for.
    expect(dueDate).toBe("2026-07-18");

    // This move crosses both collection and parent, so it used to trigger a
    // second full-rewrite query against the *source* list (normalizeCollectionScope).
    // Gap numbering makes that unnecessary: the only order_value write is the
    // single midpoint write for the moved task in its new (empty) destination list.
    const orderWrites = tx.calls.filter((c) => /SET order_value/.test(c.sql));
    expect(orderWrites).toHaveLength(1);
    expect(orderWrites[0].params).toEqual([0, taskId]);
  });
});

describe("moveTask section scope", () => {
  const sectionId = "section-1";

  it("files the task into an explicit section when dropped on a sibling row", async () => {
    // Dropped onto another top-level row: no destParent, so the only signal
    // that this belongs in a section is the explicit `sectionId` on the input -
    // this is the row-to-row drag gesture, not the empty-section-container one.
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ section_id: null })],
    });
    const tx = mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
    ]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      sectionId,
      scope: scopeCollection,
      position: 0,
    });

    const rootWrite = tx.calls.find((c) => /UPDATE tasks\s+SET parent_task_id/.test(c.sql));
    const [, , destSectionId] = rootWrite!.params as unknown[];
    expect(destSectionId).toBe(sectionId);

    const scopeQuery = tx.calls.find((c) => /section_id IS NOT DISTINCT FROM/.test(c.sql));
    expect(scopeQuery?.params).toEqual([collectionId, sectionId, null, taskId]);
  });

  it("files the task into a section via an explicit section scope, dropped on the empty container", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ section_id: null })],
    });
    mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
    ]);

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      sectionId,
      scope: { kind: "section", sectionId },
      position: Number.MAX_SAFE_INTEGER,
    });

    expect(result.reordered).toHaveLength(1);
  });

  it("preserves the task's current section when a plain reorder omits sectionId", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ section_id: sectionId })],
    });
    const tx = mockTransaction([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: sectionId, due_date: null }]],
    ]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      scope: scopeCollection,
      position: 0,
    });

    const rootWrite = tx.calls.find((c) => /UPDATE tasks\s+SET parent_task_id/.test(c.sql));
    const [, , destSectionId] = rootWrite!.params as unknown[];
    expect(destSectionId).toBe(sectionId);
  });

  it("rejects a section scope without a section id", async () => {
    await expectRejection(
      moveTask(taskId, userId, {
        parentTaskId: null,
        scope: { kind: "section" } as unknown as Parameters<typeof moveTask>[2]["scope"],
        position: 0,
      }),
      "scope.sectionId",
      /Section scope requires a section id/,
    );
  });
});

describe("moveTask subtree propagation", () => {
  const sourceSectionId = "section-1";
  const targetSectionId = "section-2";
  const subtree = [
    {
      id: taskId,
      parent_task_id: null,
      depth: 0,
      collection_id: collectionId,
      section_id: sourceSectionId,
      due_date: "2026-07-18",
    },
    {
      id: "child-1",
      parent_task_id: taskId,
      depth: 1,
      collection_id: collectionId,
      section_id: sourceSectionId,
      due_date: "2026-07-18",
    },
    {
      id: "grand-1",
      parent_task_id: "child-1",
      depth: 2,
      collection_id: collectionId,
      section_id: sourceSectionId,
      due_date: "2026-07-18",
    },
  ];

  it("clears the root section and rewrites descendants when crossing collections", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18", section_id: sourceSectionId })],
    });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      collectionId: "collection-2",
      scope: { kind: "collection", collectionId: "collection-2" },
      position: 0,
    });

    const rootWrite = tx.calls.find((c) => /UPDATE tasks\s+SET parent_task_id/.test(c.sql));
    const [, , destSectionId] = rootWrite!.params as unknown[];
    expect(destSectionId).toBeNull();

    const collectionWrite = tx.calls.find((c) => /SET collection_id = \$1, section_id = \$2/.test(c.sql));
    expect(collectionWrite?.params).toEqual(["collection-2", null, ["child-1", "grand-1"]]);
  });

  it("rewrites descendant sections when moving within the same collection", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18", section_id: sourceSectionId })],
    });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      sectionId: targetSectionId,
      scope: scopeCollection,
      position: 0,
    });

    const rootWrite = tx.calls.find((c) => /UPDATE tasks\s+SET parent_task_id/.test(c.sql));
    const [, , destSectionId] = rootWrite!.params as unknown[];
    expect(destSectionId).toBe(targetSectionId);

    const sectionWrite = tx.calls.find((c) => /SET collection_id = \$1, section_id = \$2/.test(c.sql));
    expect(sectionWrite?.params).toEqual([collectionId, targetSectionId, ["child-1", "grand-1"]]);
  });

  it("keeps the due date when only the collection changes", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18" })],
    });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      collectionId: "collection-2",
      scope: { kind: "collection", collectionId: "collection-2" },
      position: 0,
    });

    // A task dragged from Daily onto a sidebar collection stays on its day.
    const rootWrite = tx.calls.find((c) => /SET parent_task_id/.test(c.sql));
    expect(rootWrite?.params[3]).toBe("2026-07-18");
    expect(tx.calls.some((c) => /SET due_date/.test(c.sql))).toBe(false);
  });

  it("applies the target date to the whole subtree on a cross-day move", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ due_date: "2026-07-18" })],
    });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      dueDate: "2026-07-20",
      scope: { kind: "day", dueDate: "2026-07-20" },
      position: 0,
    });

    const dateWrite = tx.calls.find((c) => /SET due_date = \$1/.test(c.sql));
    expect(dateWrite?.params).toEqual(["2026-07-20", ["child-1", "grand-1"]]);

    // The subtree also has to leave the old day's list. Match the bulk form
    // specifically - renumberDayScope issues its own single-task DELETE first.
    const removal = tx.calls.find((c) => /DELETE FROM task_order WHERE task_id = ANY/.test(c.sql));
    expect(removal?.params[0]).toEqual([taskId, "child-1", "grand-1"]);
  });

  it("shifts descendant depth by the root's delta when reparenting", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow({ depth: 0, due_date: "2026-07-18" })] })
      .mockResolvedValueOnce({ rows: [taskRow({ id: "new-parent", depth: 1 })] })
      .mockResolvedValue({ rows: [taskRow()] });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, {
      parentTaskId: "new-parent",
      scope: scopeCollection,
      position: 0,
    });

    // Root 0 -> 2, so descendants shift by the same +2 and keep relative depth.
    const depthWrite = tx.calls.find((c) => /SET depth = depth \+ \$1/.test(c.sql));
    expect(depthWrite?.params).toEqual([2, ["child-1", "grand-1"]]);
  });

  it("does not touch completion, priority or title", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [taskRow({ is_completed: true, priority: 1 })],
    });
    const tx = mockTransaction([[/WITH RECURSIVE/, subtree]]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 0 });

    const writes = tx.calls.filter((c) => /^UPDATE tasks/m.test(c.sql.trim()));
    for (const write of writes) {
      expect(write.sql).not.toMatch(/is_completed|priority|title|description|recurrence_rule/);
    }
  });
});
