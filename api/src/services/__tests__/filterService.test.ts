import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "fixed-uuid-for-test",
}));

vi.mock("../../parsers/filterParser.js", () => ({
  parseFilter: vi.fn((query: string) => {
    if (query === "invalid") {
      const err = new Error("Unexpected token") as Error & { position: number };
      err.position = 5;
      throw err;
    }
    return { type: "collection", name: "work" };
  }),
}));

vi.mock("../filterEvaluator.js", () => ({
  evaluateFilter: vi.fn((_expr: unknown, tasks: unknown[]) => tasks as { id: string }[]),
}));

import { createFilter, updateFilter, listFilters, deleteFilter, evaluateSavedFilter } from "../filterService.js";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "filter-1",
    user_id: "user-1",
    name: "My Filter",
    query: "today",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFilter", () => {
    it("creates and returns filter for valid input", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "fixed-uuid-for-test", name: "Work", query: "collection:work" })] });

      const filter = await createFilter("user-1", { name: "Work", query: "collection:work" });

      expect(filter.id).toBe("fixed-uuid-for-test");
      expect(filter.name).toBe("Work");
      expect(filter.query).toBe("collection:work");
    });

    it("throws on empty name", async () => {
      await expect(createFilter("user-1", { name: "", query: "today" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on name > 120 chars", async () => {
      await expect(createFilter("user-1", { name: "a".repeat(121), query: "today" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on empty query", async () => {
      await expect(createFilter("user-1", { name: "Valid", query: "" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws on invalid DSL query", async () => {
      await expect(createFilter("user-1", { name: "Valid", query: "invalid" })).rejects.toMatchObject({
        code: "FILTER_PARSE_ERROR",
      });
    });
  });

  describe("listFilters", () => {
    it("returns user's filters ordered by name", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "f1", name: "Alpha" }), makeRow({ id: "f2", name: "Beta" })] });

      const filters = await listFilters("user-1");
      expect(filters).toHaveLength(2);
      expect(filters[0].name).toBe("Alpha");
    });

    it("returns empty array when no filters", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(await listFilters("user-1")).toEqual([]);
    });
  });

  describe("updateFilter", () => {
    it("updates and returns filter", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // existing check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ name: "Renamed" })] }); // update

      const filter = await updateFilter("filter-1", "user-1", { name: "Renamed" });

      expect(filter.name).toBe("Renamed");
    });

    it("throws on non-existent filter", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(updateFilter("nonexistent", "user-1", { name: "New" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("updates query", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] });
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ query: "priority:1" })] });

      const filter = await updateFilter("filter-1", "user-1", { query: "priority:1" });

      expect(filter.query).toBe("priority:1");
    });
  });

  describe("deleteFilter", () => {
    it("deletes and returns success", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "filter-1" }] });

      const result = await deleteFilter("filter-1", "user-1");
      expect(result).toEqual({ success: true });
    });

    it("throws on non-existent filter", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(deleteFilter("nonexistent", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("evaluateSavedFilter", () => {
    it("returns results for valid filter", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ query: "collection:work" })] }); // filter lookup
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "t1", title: "Task", description: null, priority: 2, due_date: null, is_completed: false, collection_name: "work", assignee_email: null, label_names: [] }] }); // tasks

      const results = await evaluateSavedFilter("filter-1", "user-1", "2024-06-15");

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("t1");
    });

    it("throws on non-existent filter", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(evaluateSavedFilter("nonexistent", "user-1", "2024-06-15")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("returns empty array when no tasks match", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ query: "priority:1" })] }); // filter lookup
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no tasks

      const results = await evaluateSavedFilter("filter-1", "user-1", "2024-06-15");
      expect(results).toEqual([]);
    });
  });
});
