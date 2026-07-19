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

  it("writes collection order values with 1000-unit gaps in the target order", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
      [/SELECT id FROM tasks/, [{ id: "sib-a" }, { id: "sib-b" }]],
    ]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 1 });

    const orderWrites = tx.calls
      .filter((c) => /SET order_value/.test(c.sql))
      .map((c) => c.params);
    // Dragged task requested index 1, so: sib-a, task-1, sib-b.
    expect(orderWrites).toEqual([
      [0, "sib-a"],
      [1000, taskId],
      [2000, "sib-b"],
    ]);
  });

  it("clamps a position past the end of the list", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow()] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null }]],
      [/SELECT id FROM tasks/, [{ id: "sib-a" }]],
    ]);

    await moveTask(taskId, userId, { parentTaskId: null, scope: scopeCollection, position: 99 });

    const orderWrites = tx.calls.filter((c) => /SET order_value/.test(c.sql)).map((c) => c.params);
    expect(orderWrites).toEqual([
      [0, "sib-a"],
      [1000, taskId],
    ]);
  });

  it("reorders a day through task_order, leaving collection order_value untouched", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [taskRow({ due_date: "2026-07-18" })] });
    const tx = stubSuccessfulMove([
      [/WITH RECURSIVE/, [{ id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: "2026-07-18" }]],
      [/SELECT task_id FROM task_order/, [{ task_id: "other-1" }, { task_id: "other-2" }]],
    ]);

    await moveTask(taskId, userId, {
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
  });
});

describe("moveTask subtree propagation", () => {
  const subtree = [
    { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: "2026-07-18" },
    { id: "child-1", parent_task_id: taskId, depth: 1, collection_id: collectionId, section_id: null, due_date: "2026-07-18" },
    { id: "grand-1", parent_task_id: "child-1", depth: 2, collection_id: collectionId, section_id: null, due_date: "2026-07-18" },
  ];

  it("moves every descendant's collection when crossing collections", async () => {
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

    const collectionWrite = tx.calls.find((c) => /SET collection_id = \$1, section_id = NULL/.test(c.sql));
    expect(collectionWrite?.params).toEqual(["collection-2", ["child-1", "grand-1"]]);
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
