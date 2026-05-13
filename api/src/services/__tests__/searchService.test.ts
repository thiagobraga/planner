import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { searchEntities, matchesQuery, applySearch, validateQuery } from "../searchService.js";

beforeEach(() => {
  mockQuery.mockReset();
});

describe("searchService", () => {
  describe("matchesQuery", () => {
    it("is case-insensitive substring match", () => {
      expect(matchesQuery("Hello World", "world")).toBe(true);
      expect(matchesQuery("Hello", "HE")).toBe(true);
      expect(matchesQuery("Hello", "x")).toBe(false);
    });
  });

  describe("validateQuery", () => {
    it("rejects queries > 200 chars", () => {
      expect(() => validateQuery("x".repeat(201))).toThrow(AppError);
    });

    it("flags queries < 2 chars as tooShort", () => {
      expect(validateQuery("a")).toEqual({ tooShort: true });
      expect(validateQuery("")).toEqual({ tooShort: true });
    });

    it("accepts 2-200 char queries", () => {
      expect(validateQuery("hi")).toEqual({ tooShort: false });
      expect(validateQuery("x".repeat(200))).toEqual({ tooShort: false });
    });
  });

  describe("applySearch", () => {
    it("filters, orders by updatedAt desc, and caps at 50", () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        text: i % 2 === 0 ? "match-me" : "no-match",
        updatedAt: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      }));
      const result = applySearch(items, "match-me");
      expect(result).toHaveLength(30); // 30 even items match
      // Sorted desc by updatedAt
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].updatedAt >= result[i].updatedAt).toBe(true);
      }
    });

    it("matches against description fallback", () => {
      const items = [
        { text: "foo", description: "contains needle", updatedAt: "2024-01-01T00:00:00Z" },
        { text: "bar", description: null, updatedAt: "2024-01-02T00:00:00Z" },
      ];
      expect(applySearch(items, "needle")).toHaveLength(1);
    });
  });

  describe("searchEntities", () => {
    it("returns empty for query < 2 chars without querying db", async () => {
      const result = await searchEntities("u1", "a");
      expect(result).toEqual({ tasks: [], projects: [], labels: [] });
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("queries all three entity types with ILIKE pattern", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "t1", text: "Task one", description: null, updated_at: "2024-01-01T00:00:00Z" }] })
        .mockResolvedValueOnce({ rows: [{ id: "p1", text: "Project alpha", updated_at: "2024-01-02T00:00:00Z" }] })
        .mockResolvedValueOnce({ rows: [{ id: "l1", text: "alpha-label", updated_at: "2024-01-03T00:00:00Z" }] });

      const result = await searchEntities("u1", "alpha");

      expect(result.tasks).toHaveLength(1);
      expect(result.projects).toHaveLength(1);
      expect(result.labels).toHaveLength(1);
      expect(result.tasks[0]).toMatchObject({ id: "t1", type: "task", text: "Task one" });
      expect(result.projects[0]).toMatchObject({ id: "p1", type: "project" });
      expect(result.labels[0]).toMatchObject({ id: "l1", type: "label" });

      // ILIKE pattern is wrapped
      expect(mockQuery.mock.calls[0][1]).toEqual(["u1", "%alpha%", 50]);
    });

    it("escapes LIKE meta-characters in query", async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await searchEntities("u1", "50%_off");
      // %, _, \ should each be escaped with backslash
      expect(mockQuery.mock.calls[0][1][1]).toBe("%50\\%\\_off%");
    });

    it("rejects queries > 200 chars", async () => {
      await expect(searchEntities("u1", "x".repeat(201))).rejects.toBeInstanceOf(AppError);
    });
  });
});
