import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: { subscribe: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("uuid", () => ({
  v4: () => "task-uuid",
}));

import { createTask, updateTask } from "../taskService.js";

const userId = "user-1";
const collectionId = "collection-1";
const taskId = "task-1";

function makeTaskRow(overrides: Record<string, unknown> = {}) {
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
    status_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
});

describe("taskService: labels", () => {
  describe("createTask", () => {
    it("verifies label ownership then bulk-inserts task_labels in a transaction", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "l1" }, { id: "l2" }] }) // verifyLabelOwnership
        .mockResolvedValueOnce({ rows: [{ id: collectionId }] }); // collection access

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }) // INSERT task
        .mockResolvedValueOnce(undefined) // INSERT task_labels
        .mockResolvedValueOnce(undefined); // COMMIT

      mockQuery.mockResolvedValueOnce({ rows: [] }); // attachLabels

      const task = await createTask(userId, {
        title: "New Task",
        collectionId,
        labelIds: ["l1", "l2"],
      });

      expect(task.id).toBe(taskId);
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_labels"),
        ["task-uuid", "l1", "l2"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    it("rejects with 400 when a labelId is foreign or missing", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "l1" }] }); // only one of two owned

      await expect(
        createTask(userId, { title: "New Task", collectionId, labelIds: ["l1", "not-mine"] }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("takes the single-query fast path when no labels are given", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: collectionId }] }) // collection access
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // attachLabels

      await createTask(userId, { title: "New Task", collectionId });

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("rejects a collection the user cannot reach", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // collection access -> no match

      await expect(
        createTask(userId, { title: "New Task", collectionId: "someone-elses" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    });
  });

  describe("updateTask", () => {
    it("replaces the whole label set rather than appending", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "l3" }] }) // verifyLabelOwnership
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }); // verifyTaskAccess

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }) // UPDATE tasks
        .mockResolvedValueOnce(undefined) // DELETE FROM task_labels
        .mockResolvedValueOnce(undefined) // INSERT task_labels
        .mockResolvedValueOnce(undefined); // COMMIT

      mockQuery.mockResolvedValueOnce({ rows: [] }); // attachLabels

      await updateTask(taskId, userId, { labelIds: ["l3"] });

      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM task_labels WHERE task_id = $1",
        [taskId],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_labels"),
        [taskId, "l3"],
      );
    });

    it("clears all labels when labelIds is an empty array (delete, no insert)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeTaskRow()] }); // verifyTaskAccess

      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }) // UPDATE tasks
        .mockResolvedValueOnce(undefined) // DELETE FROM task_labels
        .mockResolvedValueOnce(undefined); // COMMIT

      mockQuery.mockResolvedValueOnce({ rows: [] }); // attachLabels

      await updateTask(taskId, userId, { labelIds: [] });

      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM task_labels WHERE task_id = $1",
        [taskId],
      );
      expect(mockClientQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_labels"),
        expect.anything(),
      );
    });

    it("rejects with 400 when a labelId is foreign or missing", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // verifyLabelOwnership: none owned

      await expect(
        updateTask(taskId, userId, { labelIds: ["not-mine"] }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("does not touch task_labels when labelIds is not provided", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [makeTaskRow()] }) // verifyTaskAccess
        .mockResolvedValueOnce({ rows: [makeTaskRow({ title: "Renamed" })] }) // UPDATE (fast path, no transaction)
        .mockResolvedValueOnce({ rows: [] }); // attachLabels

      await updateTask(taskId, userId, { title: "Renamed" });

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("rejects an empty title", async () => {
      await expect(updateTask(taskId, userId, { title: "" })).rejects.toThrow(AppError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("rejects a title longer than 500 characters", async () => {
      await expect(updateTask(taskId, userId, { title: "x".repeat(501) })).rejects.toThrow(AppError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("rejects a non-integer priority", async () => {
      await expect(updateTask(taskId, userId, { priority: 2.5 })).rejects.toThrow(AppError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("rejects a priority outside 1-4", async () => {
      await expect(updateTask(taskId, userId, { priority: 5 })).rejects.toThrow(AppError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("rejects an invalid type", async () => {
      await expect(updateTask(taskId, userId, { type: "memo" })).rejects.toThrow(AppError);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
