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

import { listSavedColors, addSavedColor, SAVED_COLOR_LIMIT } from "../savedColorService.js";
import { AppError } from "../../utils/AppError.js";

function clientSql(callIndex: number): string {
  return String(mockClientQuery.mock.calls[callIndex]?.[0] ?? "");
}

describe("savedColorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientQuery.mockResolvedValue({ rows: [] });
  });

  describe("listSavedColors", () => {
    it("returns colors most-recent-first, capped at the limit", async () => {
      mockQuery.mockResolvedValue({ rows: [{ color: "#d56b64" }, { color: "#65788a" }] });

      const colors = await listSavedColors("user-1");

      expect(colors).toEqual(["#d56b64", "#65788a"]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at DESC"),
        ["user-1", SAVED_COLOR_LIMIT],
      );
    });

    it("returns an empty array when the user has saved nothing", async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await expect(listSavedColors("user-1")).resolves.toEqual([]);
    });
  });

  describe("addSavedColor", () => {
    it("dedupes the existing row, inserts, then trims to the cap", async () => {
      mockQuery.mockResolvedValue({ rows: [{ color: "#d56b64" }] });

      const colors = await addSavedColor("user-1", "#d56b64");

      expect(clientSql(0)).toBe("BEGIN");
      expect(clientSql(1)).toContain("DELETE FROM user_saved_colors");
      expect(clientSql(1)).toContain("LOWER(color) = LOWER($2)");
      expect(mockClientQuery.mock.calls[1]?.[1]).toEqual(["user-1", "#d56b64"]);

      expect(clientSql(2)).toContain("INSERT INTO user_saved_colors");
      expect(mockClientQuery.mock.calls[2]?.[1]).toEqual(["user-1", "#d56b64"]);

      expect(clientSql(3)).toContain("id NOT IN");
      expect(mockClientQuery.mock.calls[3]?.[1]).toEqual(["user-1", SAVED_COLOR_LIMIT]);

      expect(clientSql(4)).toBe("COMMIT");
      expect(mockRelease).toHaveBeenCalled();
      expect(colors).toEqual(["#d56b64"]);
    });

    it("caps stored colors at 16", () => {
      expect(SAVED_COLOR_LIMIT).toBe(16);
    });

    it("rejects an invalid color without touching the database", async () => {
      await expect(addSavedColor("user-1", "not-a-color")).rejects.toBeInstanceOf(AppError);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("rejects a non-string color", async () => {
      await expect(addSavedColor("user-1", undefined)).rejects.toBeInstanceOf(AppError);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("accepts rgba and hsl values", async () => {
      mockQuery.mockResolvedValue({ rows: [{ color: "rgba(201,72,59,0.5)" }] });
      await expect(addSavedColor("user-1", "rgba(201,72,59,0.5)")).resolves.toEqual([
        "rgba(201,72,59,0.5)",
      ]);

      mockQuery.mockResolvedValue({ rows: [{ color: "hsl(4,55%,51%)" }] });
      await expect(addSavedColor("user-1", "hsl(4,55%,51%)")).resolves.toEqual(["hsl(4,55%,51%)"]);
    });

    it("rolls back and rethrows when a write fails", async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes("INSERT INTO")) return Promise.reject(new Error("insert failed"));
        return Promise.resolve({ rows: [] });
      });

      await expect(addSavedColor("user-1", "#d56b64")).rejects.toThrow("insert failed");
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockRelease).toHaveBeenCalled();
    });
  });
});
