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
const sourceStatusId = "status-source";
const targetStatusId = "status-target";

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
    status_id: sourceStatusId,
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

function mockPoolReads(finalRow: Record<string, unknown>) {
  (pool.query as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ rows: [taskRow()] })
    .mockResolvedValueOnce({ rows: [{ id: collectionId }] })
    .mockResolvedValueOnce({ rows: [finalRow] });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moveTask status scope", () => {
  it("moves the root into a status and writes only task_order for board ordering", async () => {
    mockPoolReads(taskRow({ status_id: targetStatusId }));
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/FROM task_statuses s[\s\S]*WHERE s.id = \$1 AND s.collection_id = \$2/, [{ id: targetStatusId, completion_status_id: "status-completed" }]],
      [/SELECT completion_status_id FROM collections WHERE id = \$1/, [{ completion_status_id: "status-completed" }]],
      [/SELECT is_completed FROM tasks/, [{ is_completed: false }]],
      [/LEFT JOIN task_order/, []],
    ]);

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      statusId: targetStatusId,
      scope: { kind: "status", collectionId, statusId: targetStatusId },
      position: 0,
    });

    const rootWrite = tx.calls.find((call) => /SET parent_task_id/.test(call.sql));
    expect(rootWrite?.params[4]).toBe(targetStatusId);
    expect(rootWrite?.params[5]).toBeNull();

    const boardWrites = tx.calls.filter((call) => /INSERT INTO task_order/.test(call.sql));
    expect(boardWrites.map((call) => call.params)).toEqual([
      [userId, taskId, "status", targetStatusId, 0],
    ]);
    expect(tx.calls.some((call) => /SET order_value/.test(call.sql))).toBe(false);
    expect(result.reordered).toEqual([
      expect.objectContaining({
        id: taskId,
        orderValue: 0,
        statusId: targetStatusId,
        priority: 4,
        isCompleted: false,
      }),
    ]);
    expect(result.moved).toEqual([
      expect.objectContaining({
        id: taskId,
        orderValue: 47000,
        statusId: targetStatusId,
        priority: 4,
        isCompleted: false,
      }),
    ]);
  });

  it("completes the root when dropped into the collection completion status and preserves its prior status", async () => {
    mockPoolReads(taskRow({ status_id: targetStatusId, is_completed: true }));
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/FROM task_statuses s[\s\S]*WHERE s.id = \$1 AND s.collection_id = \$2/, [{ id: targetStatusId, completion_status_id: targetStatusId }]],
      [/SELECT completion_status_id FROM collections WHERE id = \$1/, [{ completion_status_id: targetStatusId }]],
      [/SELECT is_completed FROM tasks/, [{ is_completed: false }]],
      [/LEFT JOIN task_order/, []],
    ]);

    const result = await moveTask(taskId, userId, {
      parentTaskId: null,
      statusId: targetStatusId,
      scope: { kind: "status", collectionId, statusId: targetStatusId },
      position: 0,
    });

    const rootWrite = tx.calls.find((call) => /SET parent_task_id/.test(call.sql));
    expect(rootWrite?.params.slice(7, 9)).toEqual([true, true]);
    expect(tx.calls.some((call) => /SET is_completed = true/.test(call.sql))).toBe(true);
    expect(result.reordered[0]).toEqual(expect.objectContaining({ isCompleted: true }));
  });

  it("clears collection-owned status state from the whole subtree on a cross-collection move", async () => {
    const destinationCollectionId = "collection-2";
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: destinationCollectionId }] })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ collection_id: destinationCollectionId, status_id: null }),
          taskRow({ id: "child-1", collection_id: destinationCollectionId, status_id: null, depth: 1 }),
        ],
      });
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
        { id: "child-1", parent_task_id: taskId, depth: 1, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/SELECT id, order_value, due_date, status_id, priority, is_completed FROM tasks/, []],
    ]);

    await moveTask(taskId, userId, {
      parentTaskId: null,
      collectionId: destinationCollectionId,
      scope: { kind: "collection", collectionId: destinationCollectionId },
      position: 0,
    });

    const rootWrite = tx.calls.find((call) => /SET parent_task_id/.test(call.sql));
    expect(rootWrite?.params[4]).toBeNull();
    expect(rootWrite?.params[6]).toBe(true);

    const descendantWrite = tx.calls.find((call) => /status_id = NULL/.test(call.sql));
    expect(descendantWrite?.params).toEqual([destinationCollectionId, null, ["child-1"]]);
  });

  it("rejects a status owned by another collection and rolls back", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: collectionId }] });
    const tx = mockTransaction([
      [/WITH RECURSIVE subtree/, [
        { id: taskId, parent_task_id: null, depth: 0, collection_id: collectionId, section_id: null, due_date: null },
      ]],
      [/FROM task_statuses s/, []],
    ]);

    await expect(moveTask(taskId, userId, {
      parentTaskId: null,
      statusId: "foreign-status",
      scope: { kind: "status", collectionId, statusId: "foreign-status" },
      position: 0,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

    expect(tx.calls.some((call) => call.sql === "ROLLBACK")).toBe(true);
    expect(tx.calls.some((call) => /^UPDATE tasks/.test(call.sql.trim()))).toBe(false);
  });

  it("rejects a status ordering scope that does not match the destination status", async () => {
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
      statusId: targetStatusId,
      scope: { kind: "status", collectionId, statusId: "different-status" },
      position: 0,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

    expect(tx.calls.some((call) => /FROM task_statuses s/.test(call.sql))).toBe(false);
  });
});
