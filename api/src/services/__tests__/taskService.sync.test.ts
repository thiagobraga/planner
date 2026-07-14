import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/pool.js", () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(() => ({
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    })),
  },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: { subscribe: vi.fn().mockResolvedValue(undefined) },
}));

import { createTask, updateTask, completeTask, reopenTask, deleteTask } from "../taskService.js";
import { redisPubClient } from "../../db/redis.js";
import pool from "../../db/pool.js";

const userId = "user-1";
const projectId = "project-1";
const taskId = "task-1";

const mockTaskRow = {
  id: taskId,
  user_id: userId,
  project_id: projectId,
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
};

function resetMocks() {
  (pool.query as ReturnType<typeof vi.fn>).mockReset();
  (pool.connect as ReturnType<typeof vi.fn>).mockReturnValue({
    query: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  });
  (redisPubClient.publish as ReturnType<typeof vi.fn>).mockReset();
  (redisPubClient.publish as ReturnType<typeof vi.fn>).mockResolvedValue(1);
}

describe("taskService: sync event emission", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("createTask", () => {
    it("emits a created sync event after successful creation", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ id: projectId }] })
        .mockResolvedValueOnce({ rows: [mockTaskRow] });

      await createTask(userId, { title: "New Task", projectId });

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("created");
      expect(event.entityId).toBe(taskId);
      expect(event.userId).toBe(userId);
      expect(event.projectId).toBe(projectId);
    });

    it("defaults type to 'task' when not provided, and propagates it in the sync payload", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ id: projectId }] })
        .mockResolvedValueOnce({ rows: [mockTaskRow] });

      await createTask(userId, { title: "New Task", projectId });

      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      const event = JSON.parse(call[1] as string);
      expect(event.payload.type).toBe("task");
    });

    it("propagates type: 'note' in the sync payload when creating a note", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [{ id: projectId }] })
        .mockResolvedValueOnce({ rows: [{ ...mockTaskRow, type: "note" }] });

      await createTask(userId, { title: "New Note", projectId, type: "note" });

      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      const event = JSON.parse(call[1] as string);
      expect(event.payload.type).toBe("note");
    });
  });

  describe("updateTask", () => {
    it("emits an updated sync event after successful update", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockTaskRow] })
        .mockResolvedValueOnce({ rows: [{ ...mockTaskRow, title: "Updated Title" }] });

      await updateTask(taskId, userId, { title: "Updated Title" });

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("updated");
      expect(event.entityId).toBe(taskId);
    });

    it("propagates type change to 'note' in the sync payload", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockTaskRow] })
        .mockResolvedValueOnce({ rows: [{ ...mockTaskRow, type: "note" }] });

      await updateTask(taskId, userId, { type: "note" });

      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      const event = JSON.parse(call[1] as string);
      expect(event.payload.type).toBe("note");
    });

    it("does not emit event when no fields change", async () => {
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [mockTaskRow] });

      await updateTask(taskId, userId, {});

      expect(redisPubClient.publish).not.toHaveBeenCalled();
    });

    it("cascades the depth delta to descendants when reparenting", async () => {
      const parentRow = { ...mockTaskRow, id: "parent-1", depth: 1 };
      // task depth 0 → newDepth = parent.depth + 1 = 2, so delta = 2
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockTaskRow] })                 // verifyTaskAccess(task)
        .mockResolvedValueOnce({ rows: [parentRow] })                   // verifyTaskAccess(parent)
        .mockResolvedValueOnce({ rows: [] })                            // detectCycle
        .mockResolvedValueOnce({ rows: [{ max_depth: 0 }] });           // maxDescendantDepth

      const clientQuery = vi
        .fn()
        .mockResolvedValueOnce(undefined)                               // BEGIN
        .mockResolvedValueOnce({ rows: [{ ...mockTaskRow, parent_task_id: "parent-1", depth: 2 }] }) // main UPDATE
        .mockResolvedValueOnce(undefined)                               // descendant UPDATE
        .mockResolvedValueOnce(undefined);                             // COMMIT
      (pool.connect as ReturnType<typeof vi.fn>).mockReturnValue({ query: clientQuery, release: vi.fn() });

      await updateTask(taskId, userId, { parentTaskId: "parent-1" });

      const descendantCall = clientQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("depth = depth +")
      );
      expect(descendantCall).toBeDefined();
      expect(descendantCall![1]).toEqual([taskId, 2]);
    });
  });

  describe("completeTask", () => {
    it("emits a completed sync event for non-recurring task", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockTaskRow] })
        .mockResolvedValueOnce({ rows: [{ ...mockTaskRow, is_completed: true, completed_at: new Date().toISOString() }] });

      await completeTask(taskId, userId);

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("completed");
      expect(event.entityId).toBe(taskId);
    });

    it("emits an updated sync event for recurring task", async () => {
      const recurringTask = {
        ...mockTaskRow,
        recurrence_rule: { freq: "DAILY" },
        due_date: "2026-05-17",
      };
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [recurringTask] })
        .mockResolvedValueOnce({ rows: [{ ...recurringTask, due_date: "2026-05-18" }] });

      await completeTask(taskId, userId);

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("updated");
      expect(event.entityId).toBe(taskId);
    });
  });

  describe("reopenTask", () => {
    it("emits an uncompleted sync event", async () => {
      const completedTask = { ...mockTaskRow, is_completed: true, completed_at: new Date().toISOString() };
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [completedTask] })
        .mockResolvedValueOnce({ rows: [{ ...completedTask, is_completed: false, completed_at: null }] });

      await reopenTask(taskId, userId);

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("uncompleted");
      expect(event.entityId).toBe(taskId);
    });
  });

  describe("deleteTask", () => {
    it("emits a deleted sync event", async () => {
      (pool.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockTaskRow] });

      (pool.connect as ReturnType<typeof vi.fn>).mockReturnValue({
        query: vi.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [{ id: taskId }] })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined),
        release: vi.fn(),
      });

      await deleteTask(taskId, userId);

      expect(redisPubClient.publish).toHaveBeenCalledTimes(1);
      const call = (redisPubClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("sync");
      const event = JSON.parse(call[1] as string);
      expect(event.entityType).toBe("task");
      expect(event.eventType).toBe("deleted");
      expect(event.entityId).toBe(taskId);
      expect(event.projectId).toBe(projectId);
    });
  });
});
