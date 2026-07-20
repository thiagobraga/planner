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

import { listSections, createSection, updateSection, deleteSection } from "../sectionService.js";

function makeSectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "section-1",
    collection_id: "col-1",
    name: "My Section",
    order_value: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("sectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSections", () => {
    it("returns sections ordered by order_value for accessible collection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // access check
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ id: "s1", order_value: 0 }), makeSectionRow({ id: "s2", order_value: 1 })] });

      const sections = await listSections("col-1", "user-1");
      expect(sections).toHaveLength(2);
    });

    it("throws when collection not accessible", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(listSections("col-1", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("createSection", () => {
    it("inserts with auto-computed order_value", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // access check
      mockQuery.mockResolvedValueOnce({ rows: [{ next_order: 5 }] }); // max order
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ id: "fixed-uuid-for-test", order_value: 5 })] });

      const section = await createSection("col-1", "user-1", { name: "New Section" });

      expect(section.id).toBe("fixed-uuid-for-test");
      expect(section.orderValue).toBe(5);
    });

    it("throws on empty name", async () => {
      await expect(createSection("col-1", "user-1", { name: "" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on name > 120 chars", async () => {
      await expect(createSection("col-1", "user-1", { name: "a".repeat(121) })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("updateSection", () => {
    it("updates name only", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow()] }); // access check
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ name: "Renamed" })] }); // final fetch

      const section = await updateSection("section-1", "user-1", { name: "Renamed" });

      expect(section.name).toBe("Renamed");
      expect(mockClientQuery).toHaveBeenCalledWith(
        "UPDATE sections SET name = $1, updated_at = NOW() WHERE id = $2",
        ["Renamed", "section-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    it("reorders siblings when position is given", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ collection_id: "col-1" })] }); // access check
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });
      mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "s2", order_value: 1000 }] }); // siblings
      mockClientQuery.mockResolvedValueOnce(undefined); // update s2
      mockClientQuery.mockResolvedValueOnce(undefined); // update s1
      mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ order_value: 0 })] }); // final fetch

      const section = await updateSection("section-1", "user-1", { position: 0 });

      expect(section).toBeDefined();
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    it("throws on invalid name", async () => {
      await expect(updateSection("section-1", "user-1", { name: "" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on invalid position", async () => {
      await expect(updateSection("section-1", "user-1", { position: -1 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("deleteSection", () => {
    it("as owner: moves tasks to parent and deletes section", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ collection_id: "col-1" })] }); // access check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "col-1" }] }); // owner check
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      const result = await deleteSection("section-1", "user-1");

      expect(result).toEqual({ success: true });
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith(
        "UPDATE tasks SET section_id = NULL, updated_at = NOW() WHERE section_id = $1",
        ["section-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM sections WHERE id = $1",
        ["section-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    it("as collaborator: throws 403", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeSectionRow({ collection_id: "col-1" })] }); // access check
      mockQuery.mockResolvedValueOnce({ rows: [] }); // owner check fails

      await expect(deleteSection("section-1", "user-2")).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("throws on non-existent section", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(deleteSection("nonexistent", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
