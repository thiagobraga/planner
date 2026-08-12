import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "fixed-uuid-for-test"),
}));

const mockPublishEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("../syncService.js", () => ({
  buildEvent: (input: Record<string, unknown>) => ({ id: "evt-1", emittedAt: "now", ...input }),
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import {
  listStatuses,
  ensureCollectionStatuses,
  createStatus,
  updateStatus,
  setCollectionCompletionStatus,
  deleteStatus,
} from "../statusService.js";

function makeStatusRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "status-1",
    collection_id: "col-1",
    name: "Todo",
    color: "#adb9c1",
    order_value: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("statusService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConnect as ReturnType<typeof vi.fn>).mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
  });

  describe("listStatuses", () => {
    it("returns statuses ordered by order_value for accessible collection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // access check
      mockQuery.mockResolvedValueOnce({
        rows: [makeStatusRow({ id: "s1" }), makeStatusRow({ id: "s2", order_value: 1000 })],
      });

      const statuses = await listStatuses("col-1", "user-1");
      expect(statuses).toHaveLength(2);
    });

    it("throws when collection not accessible", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(listStatuses("col-1", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("ensureCollectionStatuses", () => {
    it("is idempotent - returns existing statuses without seeding again", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // access check
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "s2" }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [makeStatusRow({ id: "s1" }), makeStatusRow({ id: "s2" })],
      }); // existing
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // file completed tasks
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // file open tasks
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT

      const statuses = await ensureCollectionStatuses("col-1", "user-1");

      expect(statuses).toHaveLength(2);
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, completion_status_id FROM collections"),
        ["col-1"],
      );
      expect(mockClientQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO task_statuses"), expect.anything());
    });

    it("files tasks created after the initial seed without creating duplicate statuses", async () => {
      const existing = [
        makeStatusRow({ id: "s-backlog" }),
        makeStatusRow({ id: "s-done", order_value: 1000 }),
      ];
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] });
      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "s-done" }] })
        .mockResolvedValueOnce({ rows: existing })
        .mockResolvedValueOnce({ rows: [{ id: "late-completed" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "late-open" }], rowCount: 1 })
        .mockResolvedValueOnce(undefined); // COMMIT

      await ensureCollectionStatuses("col-1", "user-1");

      expect(mockClientQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO task_statuses"), expect.anything());
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("status_id IS NULL AND is_completed = true"),
        ["s-done", "col-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("status_id IS NULL AND is_completed = false"),
        ["s-backlog", "col-1"],
      );
      expect(mockPublishEvent).toHaveBeenCalledTimes(2);
    });

    it("files late tasks by the collection completion mapping even when that status is ordered first", async () => {
      const existing = [
        makeStatusRow({ id: "s-done", order_value: 0 }),
        makeStatusRow({ id: "s-backlog", order_value: 1000 }),
      ];
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "s-done" }] })
        .mockResolvedValueOnce({ rows: existing })
        .mockResolvedValueOnce({ rows: [{ id: "late-completed" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "late-open" }], rowCount: 1 })
        .mockResolvedValueOnce(undefined);

      await ensureCollectionStatuses("col-1", "user-1");

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("is_completed = true"),
        ["s-done", "col-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("is_completed = false"),
        ["s-backlog", "col-1"],
      );
    });

    it("rejects existing statuses without a collection completion mapping instead of guessing", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: null }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow({ id: "s-backlog" })] })
        .mockResolvedValueOnce(undefined);

      await expect(ensureCollectionStatuses("col-1", "user-1")).rejects.toThrow(
        "Collection col-1 has statuses but no completion status",
      );

      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClientQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("SET completion_status_id = $1"),
        expect.anything(),
      );
    });

    it("leaves tasks unfiled when no status matches their completion state", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "s-done" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow({ id: "s-done" })] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce(undefined);

      await ensureCollectionStatuses("col-1", "user-1");

      const filingQueries = mockClientQuery.mock.calls.filter(([sql]) =>
        typeof sql === "string" && sql.includes("UPDATE tasks SET status_id"),
      );
      expect(filingQueries).toHaveLength(1);
      expect(filingQueries[0][0]).toContain("is_completed = true");
    });

    it("seeds four defaults, assigns the collection completion status, and files status-less tasks", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // access check
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: null }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // no existing statuses
      mockClientQuery.mockResolvedValueOnce({ rows: [{ locale: "en" }] }); // locale

      const created = [
        makeStatusRow({ id: "s-backlog", name: "Backlog", order_value: 0 }),
        makeStatusRow({ id: "s-todo", name: "Todo", order_value: 1000 }),
        makeStatusRow({ id: "s-doing", name: "Doing", order_value: 2000 }),
        makeStatusRow({ id: "s-done", name: "Completed", order_value: 3000 }),
      ];
      for (const row of created) {
        mockClientQuery.mockResolvedValueOnce({ rows: [row] }); // INSERT
      }
      mockClientQuery.mockResolvedValueOnce(undefined); // set collection completion status
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE completed tasks
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE open tasks
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT

      const statuses = await ensureCollectionStatuses("col-1", "user-1");

      expect(statuses).toHaveLength(4);
      expect(statuses.map((s) => s.name)).toEqual(["Backlog", "Todo", "Doing", "Completed"]);
      expect(statuses.some((s) => "isDoneLike" in s)).toBe(false);
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET completion_status_id = $1"),
        ["s-done", "col-1"],
      );

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE collection_id = $2 AND status_id IS NULL AND is_completed = true"),
        ["s-done", "col-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE collection_id = $2 AND status_id IS NULL AND is_completed = false"),
        ["s-backlog", "col-1"],
      );
      expect(mockPublishEvent).toHaveBeenCalledTimes(4);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "status", eventType: "created", collectionId: "col-1" }),
      );
    });

    it("does not double-seed on a second open (reload does not seed eight)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] });
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "s4" }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [makeStatusRow({ id: "s1" }), makeStatusRow({ id: "s2" }), makeStatusRow({ id: "s3" }), makeStatusRow({ id: "s4" })],
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT

      const statuses = await ensureCollectionStatuses("col-1", "user-1");
      expect(statuses).toHaveLength(4);
    });
  });

  describe("createStatus", () => {
    it("appends at MAX(order_value) + 1000 and publishes", async () => {
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-completed" }] })
        .mockResolvedValueOnce({ rows: [{ next_order: 4000 }] })
        .mockResolvedValueOnce({
          rows: [makeStatusRow({ id: "fixed-uuid-for-test", name: "Review", order_value: 4000 })],
        })
        .mockResolvedValueOnce(undefined);

      const status = await createStatus("col-1", "user-1", { name: "Review" });

      expect(status.id).toBe("fixed-uuid-for-test");
      expect(status.orderValue).toBe(4000);
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("makes the first manually created status the collection completion status", async () => {
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: null }] })
        .mockResolvedValueOnce({ rows: [{ next_order: 0 }] })
        .mockResolvedValueOnce({
          rows: [makeStatusRow({ id: "fixed-uuid-for-test", name: "Completed" })],
        })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await createStatus("col-1", "user-1", { name: "Completed" });

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET completion_status_id = $1"),
        ["fixed-uuid-for-test", "col-1"],
      );
    });

    it("throws on invalid color", async () => {
      await expect(createStatus("col-1", "user-1", { name: "Review", color: "not-a-color" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on empty name", async () => {
      await expect(createStatus("col-1", "user-1", { name: "" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("updateStatus", () => {
    it("renames and publishes", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow()] }); // access check
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce(undefined); // UPDATE name
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ name: "Renamed" })] }); // final fetch

      const status = await updateStatus("status-1", "user-1", { name: "Renamed" });

      expect(status.name).toBe("Renamed");
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("reorders siblings when position is given (splice-and-rewrite)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] }); // access check
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "s2", order_value: 1000 }] }); // siblings
      mockClientQuery.mockResolvedValueOnce(undefined); // update s (moved)
      mockClientQuery.mockResolvedValueOnce(undefined); // update s2
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ order_value: 0 })] }); // final fetch

      const status = await updateStatus("status-1", "user-1", { position: 0 });

      expect(status).toBeDefined();
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    it("throws on invalid position", async () => {
      await expect(updateStatus("status-1", "user-1", { position: -1 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("setCollectionCompletionStatus", () => {
    it("updates the one collection pointer and publishes", async () => {
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-1" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await expect(setCollectionCompletionStatus("col-1", "user-1", "status-2")).resolves.toEqual({
        completionStatusId: "status-2",
      });

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET completion_status_id = $1"),
        ["status-2", "col-1"],
      );
      expect(mockPublishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "status", eventType: "updated", collectionId: "col-1" }),
      );
    });

    it("reopens tasks in the former completion status and completes tasks in the new one", async () => {
      mockClientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql === "BEGIN" || sql === "COMMIT") return undefined;
        if (sql.includes("SELECT id, completion_status_id FROM collections")) {
          return { rows: [{ id: "col-1", completion_status_id: "status-1" }] };
        }
        if (sql.includes("SELECT * FROM task_statuses")) {
          return { rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })] };
        }
        if (sql.includes("SELECT id, status_id FROM tasks")) {
          return { rows: [{ id: "old-task", status_id: "status-1" }, { id: "new-task", status_id: "status-2" }] };
        }
        if (sql.includes("SELECT completion_status_id FROM collections")) {
          return { rows: [{ completion_status_id: "status-2" }] };
        }
        if (sql.includes("SELECT is_completed FROM tasks")) {
          return { rows: [{ is_completed: params?.[0] === "old-task" }] };
        }
        return { rows: [] };
      });

      await setCollectionCompletionStatus("col-1", "user-1", "status-2");

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET is_completed = false"),
        ["old-task"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET is_completed = true"),
        ["new-task"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE collection_id = $1 AND status_id = $2"),
        ["col-1", "status-1"],
      );
      expect(mockClientQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("previous_status_id = NULL"),
        ["col-1", ["status-1", "status-2"]],
      );
    });

    it("rejects a completion status from another collection", async () => {
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-1" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow()] })
        .mockResolvedValueOnce(undefined);

      await expect(setCollectionCompletionStatus("col-1", "user-1", "foreign-status")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("deleteStatus", () => {
    it("reassigns tasks to the given status and deletes", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-2" }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })],
      }); // locked status set
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE tasks status_id
      mockClientQuery.mockResolvedValueOnce(undefined); // UPDATE tasks previous_status_id
      mockClientQuery.mockResolvedValueOnce(undefined); // DELETE
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT

      const result = await deleteStatus("status-1", "user-1", { reassignToStatusId: "status-2" });

      expect(result).toEqual({ success: true });
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tasks SET status_id = $1"),
        ["status-2", "status-1"],
      );
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY id FOR UPDATE"),
        ["col-1"],
      );
    });

    it("refuses to delete the collection's last status (409)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-1" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow()] })
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(deleteStatus("status-1", "user-1")).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });

    it("rejects reassignment to a status from another collection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-3" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow(), makeStatusRow({ id: "status-3" })] })
        .mockResolvedValueOnce(undefined);

      await expect(
        deleteStatus("status-1", "user-1", { reassignToStatusId: "status-2" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    });

    it("rejects reassignment to the status being deleted", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-2" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })] })
        .mockResolvedValueOnce(undefined);

      await expect(
        deleteStatus("status-1", "user-1", { reassignToStatusId: "status-1" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    });

    it("requires reassignment before deleting the collection completion status", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-1" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })] })
        .mockResolvedValueOnce(undefined);

      await expect(deleteStatus("status-1", "user-1")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    });

    it("moves the collection completion pointer before deleting its status", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeStatusRow({ collection_id: "col-1" })] });
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-1" }] })
        .mockResolvedValueOnce({ rows: [makeStatusRow(), makeStatusRow({ id: "status-2" })] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await deleteStatus("status-1", "user-1", { reassignToStatusId: "status-2" });

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET completion_status_id = $1"),
        ["status-2", "col-1"],
      );
    });
  });

  it("every mutation publishes an entityType: 'status' event with collectionId", async () => {
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ id: "col-1", completion_status_id: "status-completed" }] })
      .mockResolvedValueOnce({ rows: [{ next_order: 0 }] })
      .mockResolvedValueOnce({ rows: [makeStatusRow({ id: "fixed-uuid-for-test" })] })
      .mockResolvedValueOnce(undefined);

    await createStatus("col-1", "user-1", { name: "Todo" });

    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "status", collectionId: "col-1" }),
    );
  });
});
