import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

vi.mock("../../db/pool.js", () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../syncService.js", () => ({
  buildEvent: (e: unknown) => e,
  publishEvent: () => Promise.resolve(),
}));

import { reorderTask } from "../taskService.js";
import pool from "../../db/pool.js";

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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  (pool.query as ReturnType<typeof vi.fn>).mockReset();
  (pool.connect as ReturnType<typeof vi.fn>).mockReset();
});

describe("reorderTask", () => {
  it("rejects a non-integer position", async () => {
    await expect(reorderTask(taskId, userId, 1.5)).rejects.toThrow(AppError);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects a negative position", async () => {
    await expect(reorderTask(taskId, userId, -1)).rejects.toThrow(AppError);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("reorders the task among its siblings using gap-based ordering", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] }) // verifyTaskAccess
      .mockResolvedValueOnce({ rows: [taskRow({ id: taskId, order_value: 0 })] }); // SELECT * after commit

    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: "sibling-1", order_value: 0 },
          { id: "sibling-2", order_value: 1000 },
        ],
      }) // siblings
      .mockResolvedValueOnce(undefined) // UPDATE sibling-1 -> 0
      .mockResolvedValueOnce(undefined) // UPDATE sibling-2 -> 1000
      .mockResolvedValueOnce(undefined) // UPDATE task -> 2000
      .mockResolvedValueOnce(undefined); // COMMIT

    (pool.connect as ReturnType<typeof vi.fn>).mockReturnValue({ query: clientQuery, release: vi.fn() });

    const task = await reorderTask(taskId, userId, 2);

    expect(task.id).toBe(taskId);
    const updates = clientQuery.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("UPDATE tasks SET order_value"),
    );
    expect(updates).toHaveLength(3);
    expect(updates[0]?.[1]).toEqual([0, "sibling-1"]);
    expect(updates[1]?.[1]).toEqual([1000, "sibling-2"]);
    expect(updates[2]?.[1]).toEqual([2000, taskId]);
  });

  it("clamps the position to the sibling count", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [taskRow({ id: taskId, order_value: 1000 })] });

    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "sibling-1", order_value: 0 }] }) // one sibling
      .mockResolvedValueOnce(undefined) // UPDATE sibling-1 -> 0
      .mockResolvedValueOnce(undefined) // UPDATE task -> 1000
      .mockResolvedValueOnce(undefined); // COMMIT

    (pool.connect as ReturnType<typeof vi.fn>).mockReturnValue({ query: clientQuery, release: vi.fn() });

    const task = await reorderTask(taskId, userId, 99);

    expect(task.id).toBe(taskId);
    const updates = clientQuery.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("UPDATE tasks SET order_value"),
    );
    expect(updates[updates.length - 1]?.[1]).toEqual([1000, taskId]);
  });
});
