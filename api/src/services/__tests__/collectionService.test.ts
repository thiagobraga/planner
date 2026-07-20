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
  v4: () => "fixed-uuid-for-test",
}));

const mockPublishEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("../syncService.js", () => ({
  buildEvent: vi.fn((params: Record<string, unknown>) => ({
    id: "evt-" + params.entityId,
    entityType: params.entityType,
    eventType: params.eventType,
    entityId: params.entityId,
    userId: params.userId,
    collectionId: params.entityId,
    payload: params.payload,
    emittedAt: new Date().toISOString(),
  })),
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  archiveCollection,
} from "../collectionService.js";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "col-1",
    user_id: "user-1",
    parent_id: null,
    name: "My Collection",
    color: "blue",
    is_inbox: false,
    is_archived: false,
    order_value: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("collectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCollections", () => {
    it("returns owned + shared collections ordered by order_value, created_at", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "c1" }), makeRow({ id: "c2" })] });

      const cols = await listCollections("user-1");
      expect(cols).toHaveLength(2);
      expect(cols[0].id).toBe("c1");
    });

    it("returns empty array when user has no collections", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      expect(await listCollections("user-1")).toEqual([]);
    });
  });

  describe("createCollection", () => {
    it("inserts and publishes sync event for valid input", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "fixed-uuid-for-test", name: "New", color: "green" })] });

      const col = await createCollection("user-1", { name: "New", color: "green" });

      expect(col.id).toBe("fixed-uuid-for-test");
      expect(col.name).toBe("New");
      expect(col.color).toBe("green");
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("throws on empty name", async () => {
      await expect(createCollection("user-1", { name: "", color: "blue" })).rejects.toThrow();
    });

    it("throws on invalid color", async () => {
      await expect(createCollection("user-1", { name: "Valid", color: "hotpink" })).rejects.toThrow();
    });

    it("throws on duplicate name", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing" }] });

      await expect(createCollection("user-1", { name: "dup", color: "blue" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("creates with parentId and publishes sync event", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "parent-1" })] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [{ max_depth: 1 }] }); // depth check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "fixed-uuid-for-test", parent_id: "parent-1" })] });

      const col = await createCollection("user-1", { name: "Child", color: "blue", parentId: "parent-1" });

      expect(col.parentId).toBe("parent-1");
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("throws when nesting depth exceeds 4", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "parent-1" })] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [{ max_depth: 4 }] }); // depth check

      await expect(createCollection("user-1", { name: "Too deep", color: "blue", parentId: "parent-1" })).rejects.toMatchObject({
        code: "MAX_DEPTH_EXCEEDED",
      });
    });
  });

  describe("updateCollection", () => {
    it("updates name and publishes sync event", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ name: "Renamed" })] }); // update

      const col = await updateCollection("col-1", "user-1", { name: "Renamed" });

      expect(col.name).toBe("Renamed");
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("throws on inbox rename", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ is_inbox: true })] });

      await expect(updateCollection("col-1", "user-1", { name: "Renamed" })).rejects.toMatchObject({
        code: "INBOX_PROTECTED",
      });
    });

    it("throws on reparent cycle", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "parent-1" })] }); // parent exists + owned
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // cycle detection: isSelfOrDescendant returns true

      await expect(updateCollection("col-1", "user-1", { parentId: "parent-1" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    });

    it("throws when reparent exceeds max depth", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "parent-1" })] }); // parent exists + owned
      mockQuery.mockResolvedValueOnce({ rows: [] }); // isSelfOrDescendant returns false
      mockQuery.mockResolvedValueOnce({ rows: [{ max_depth: 4 }] }); // depth check

      await expect(updateCollection("col-1", "user-1", { parentId: "parent-1" })).rejects.toMatchObject({
        code: "MAX_DEPTH_EXCEEDED",
      });
    });

    it("throws on self-parent", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check

      await expect(updateCollection("col-1", "user-1", { parentId: "col-1" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    });

    it("returns existing when no updates provided", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] });

      const col = await updateCollection("col-1", "user-1", {});
      expect(col.name).toBe("My Collection");
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });
  });

  describe("deleteCollection", () => {
    it("cascade deletes and publishes sync event", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      const result = await deleteCollection("col-1", "user-1");

      expect(result).toEqual({ success: true });
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM tasks WHERE collection_id = $1",
        ["col-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockRelease).toHaveBeenCalled();
    });

    it("throws on inbox delete", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ is_inbox: true })] });

      await expect(deleteCollection("col-1", "user-1")).rejects.toMatchObject({
        code: "INBOX_PROTECTED",
      });
    });
  });

  describe("archiveCollection", () => {
    it("archives and publishes sync event", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // ownership check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ is_archived: true })] });

      const col = await archiveCollection("col-1", "user-1");

      expect(col.isArchived).toBe(true);
      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    });

    it("throws on inbox archive", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ is_inbox: true })] });

      await expect(archiveCollection("col-1", "user-1")).rejects.toMatchObject({
        code: "INBOX_PROTECTED",
      });
    });
  });
});
