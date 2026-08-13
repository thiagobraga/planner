import { beforeEach, describe, expect, it, vi } from "vitest";

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

import pool from "../../db/pool.js";
import { moveTask } from "../taskService.js";

const userId = "user-1";
const collectionId = "collection-1";
const taskId = "task-1";

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    user_id: userId,
    collection_id: collectionId,
    section_id: null,
    parent_task_id: null,
    assignee_user_id: null,
    title: "Task",
    description: null,
    priority: 4,
    due_date: null,
    due_time: null,
    due_timezone: null,
    recurrence_rule: null,
    is_completed: false,
    completed_at: null,
    order_value: 47000,
    depth: 0,
    type: "task",
    status_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockTransaction(rowsFor: Array<[RegExp, unknown[]]> = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [pattern, rows] of rowsFor) {
      if (pattern.test(sql)) return { rows };
    }
    return { rows: [] };
  });
  (pool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({ query, release: vi.fn() });
  return { calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moveTask priority scope", () => {
  it("updates priority and writes board order without changing collection order_value", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
      .mockResolvedValueOnce({ rows: [taskRow({ priority: 2 })] });
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/LEFT JOIN task_order/, []],
    ]);

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      priority: 2,
      scope: { kind: "priority", collectionId, priority: 2 },
      position: 0,
    });

    const rootWrite = tx.calls.find((call) => /SET parent_task_id/.test(call.sql));
    expect(rootWrite?.params[4]).toBeNull();
    expect(rootWrite?.params[5]).toBe(2);
    expect(tx.calls.filter((call) => /INSERT INTO task_order/.test(call.sql)).map((call) => call.params)).toEqual([
      [userId, taskId, "priority", "2", 0],
    ]);
    expect(tx.calls.some((call) => /SET order_value/.test(call.sql))).toBe(false);
    expect(result.reordered[0]).toEqual(expect.objectContaining({
      id: taskId,
      orderValue: 0,
      statusId: null,
      priority: 2,
      isCompleted: false,
    }));
    expect(result.moved[0]).toEqual(expect.objectContaining({
      id: taskId,
      orderValue: 47000,
      priority: 2,
    }));
  });

  it("reorders within the current priority when the root value is omitted", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow({ priority: 2 })] })
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
      .mockResolvedValueOnce({ rows: [taskRow({ priority: 2 })] });
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/LEFT JOIN task_order/, []],
    ]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      scope: { kind: "priority", collectionId, priority: 2 },
      position: 0,
    });

    const rootWrite = tx.calls.find((call) => /SET parent_task_id/.test(call.sql));
    expect(rootWrite?.params[5]).toBeNull();
    expect(tx.calls.some((call) => /INSERT INTO task_order/.test(call.sql))).toBe(true);
  });

  it("rejects priority and scope values outside 1 through 4 before opening a transaction", async () => {
    await expect(moveTask(taskId, userId, {
      parentTaskId: null,
      priority: 0,
      scope: { kind: "priority", collectionId, priority: 0 },
      position: 0,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects a priority scope that does not match the destination value", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] });
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
    ]);

    await expect(moveTask(taskId, userId, {
      parentTaskId: null,
      priority: 2,
      scope: { kind: "priority", collectionId, priority: 3 },
      position: 0,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

    expect(tx.calls.some((call) => /^UPDATE tasks/.test(call.sql.trim()))).toBe(false);
    expect(tx.calls.some((call) => call.sql === "ROLLBACK")).toBe(true);
  });
});
