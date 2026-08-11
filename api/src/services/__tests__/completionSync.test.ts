import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import { syncCompletionToStatus, syncStatusToCompletion } from "../completionSync.js";

function makeClient() {
  const query = vi.fn();
  return { query } as unknown as PoolClient & { query: ReturnType<typeof vi.fn> };
}

describe("completionSync", () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  describe("syncCompletionToStatus", () => {
    it("done-like + not completed: completes the task and cascades to descendants", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ is_done_like: true }] }) // status lookup
        .mockResolvedValueOnce({ rows: [{ is_completed: false }] }) // task lookup
        .mockResolvedValueOnce(undefined) // UPDATE tasks is_completed=true
        .mockResolvedValueOnce(undefined) // cascade UPDATE
        .mockResolvedValueOnce(undefined); // activity event

      const result = await syncCompletionToStatus(client, {
        taskId: "t1",
        userId: "u1",
        statusId: "s-done",
        collectionId: "c1",
      });

      expect(result).toBe("completed");
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET is_completed = true"),
        ["t1"],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("WITH RECURSIVE descendants"),
        ["t1"],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("'task_completed'"),
        ["u1", "c1", "t1"],
      );
    });

    it("non-done-like + completed: reopens without cascading", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ is_done_like: false }] })
        .mockResolvedValueOnce({ rows: [{ is_completed: true }] })
        .mockResolvedValueOnce(undefined) // UPDATE tasks is_completed=false
        .mockResolvedValueOnce(undefined); // activity event

      const result = await syncCompletionToStatus(client, {
        taskId: "t1",
        userId: "u1",
        statusId: "s-todo",
        collectionId: "c1",
      });

      expect(result).toBe("reopened");
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET is_completed = false"),
        ["t1"],
      );
      expect(client.query).not.toHaveBeenCalledWith(
        expect.stringContaining("WITH RECURSIVE descendants"),
        expect.anything(),
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("'task_reopened'"),
        ["u1", "c1", "t1"],
      );
    });

    it("returns null when already aligned (done-like + completed)", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ is_done_like: true }] })
        .mockResolvedValueOnce({ rows: [{ is_completed: true }] });

      const result = await syncCompletionToStatus(client, {
        taskId: "t1",
        userId: "u1",
        statusId: "s-done",
        collectionId: "c1",
      });

      expect(result).toBeNull();
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    it("returns null when already aligned (non-done-like + open)", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ is_done_like: false }] })
        .mockResolvedValueOnce({ rows: [{ is_completed: false }] });

      const result = await syncCompletionToStatus(client, {
        taskId: "t1",
        userId: "u1",
        statusId: "s-todo",
        collectionId: "c1",
      });

      expect(result).toBeNull();
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    it("returns null and skips queries when statusId is null", async () => {
      const result = await syncCompletionToStatus(client, {
        taskId: "t1",
        userId: "u1",
        statusId: null,
        collectionId: "c1",
      });

      expect(result).toBeNull();
      expect(client.query).not.toHaveBeenCalled();
    });
  });

  describe("syncStatusToCompletion", () => {
    it("completing: moves the task and descendants to the first done-like status", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ status_id: "s-doing", previous_status_id: null }] }) // task lookup
        .mockResolvedValueOnce({ rows: [{ id: "s-completed" }] }) // first done-like
        .mockResolvedValueOnce(undefined); // UPDATE

      await syncStatusToCompletion(client, {
        taskId: "t1",
        userId: "u1",
        collectionId: "c1",
        isCompleted: true,
        includeDescendants: true,
      });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("WITH RECURSIVE affected"),
        ["t1", "s-completed"],
      );
      const updateSql = client.query.mock.calls[2][0] as string;
      expect(updateSql).toContain("previous_status_id = a.status_id");
      expect(updateSql).toContain("INNER JOIN affected a ON t.parent_task_id = a.id");
      expect(updateSql).toContain("t.status_id IS DISTINCT FROM $2");
    });

    it("completing without descendant propagation only moves the requested task", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ status_id: "s-doing", previous_status_id: null }] })
        .mockResolvedValueOnce({ rows: [{ id: "s-completed" }] })
        .mockResolvedValueOnce(undefined);

      await syncStatusToCompletion(client, {
        taskId: "t1",
        userId: "u1",
        collectionId: "c1",
        isCompleted: true,
      });

      const updateSql = client.query.mock.calls[2][0] as string;
      expect(updateSql).not.toContain("WITH RECURSIVE");
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("previous_status_id = status_id"),
        ["s-completed", "t1"],
      );
    });

    it("reopening: status_id restores from previous_status_id, previous cleared - round-trips", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ status_id: "s-completed", previous_status_id: "s-doing" }] }) // task lookup
        .mockResolvedValueOnce(undefined); // UPDATE (no fallback query needed - previous_status_id present)

      await syncStatusToCompletion(client, {
        taskId: "t1",
        userId: "u1",
        collectionId: "c1",
        isCompleted: false,
      });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status_id = $1, previous_status_id = NULL"),
        ["s-doing", "t1"],
      );
    });

    it("reopening with no previous_status_id: falls back to first non-done-like status", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ status_id: "s-completed", previous_status_id: null }] }) // task lookup
        .mockResolvedValueOnce({ rows: [{ id: "s-backlog" }] }) // fallback: first non-done-like
        .mockResolvedValueOnce(undefined); // UPDATE

      await syncStatusToCompletion(client, {
        taskId: "t1",
        userId: "u1",
        collectionId: "c1",
        isCompleted: false,
      });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status_id = $1, previous_status_id = NULL"),
        ["s-backlog", "t1"],
      );
    });

    it("no-ops when the task does not exist", async () => {
      client.query.mockResolvedValueOnce({ rows: [] });

      await syncStatusToCompletion(client, {
        taskId: "missing",
        userId: "u1",
        collectionId: "c1",
        isCompleted: true,
      });

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it("no-ops on complete when the collection has no done-like status yet", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ status_id: "s-doing", previous_status_id: null }] })
        .mockResolvedValueOnce({ rows: [] }); // no done-like status

      await syncStatusToCompletion(client, {
        taskId: "t1",
        userId: "u1",
        collectionId: "c1",
        isCompleted: true,
      });

      expect(client.query).toHaveBeenCalledTimes(2);
    });
  });
});
