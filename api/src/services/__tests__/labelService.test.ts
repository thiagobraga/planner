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
  buildEvent: (input: Record<string, unknown>) => ({ id: "evt-1", emittedAt: "now", ...input }),
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import { listLabels, ensureSeedLabels, createLabel, updateLabel, deleteLabel } from "../labelService.js";
import { AppError } from "../../utils/AppError.js";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "label-1",
    user_id: "user-1",
    name: "my_label",
    color: "#65788a",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("labelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listLabels", () => {
    it("returns user's labels ordered by name", async () => {
      mockQuery.mockResolvedValue({ rows: [makeRow({ id: "l1", name: "alpha" }), makeRow({ id: "l2", name: "beta" })] });
      const labels = await listLabels("user-1");
      expect(labels).toHaveLength(2);
      expect(labels[0].name).toBe("alpha");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY name ASC"),
        ["user-1"],
      );
    });

    it("returns empty array when no labels", async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const labels = await listLabels("user-1");
      expect(labels).toEqual([]);
    });
  });

  describe("ensureSeedLabels", () => {
    it("serializes on the user and creates the three defaults once", async () => {
      const seedRows = [
        makeRow({ id: "feature-id", name: "feature", color: "#7dbfb2" }),
        makeRow({ id: "bug-id", name: "bug", color: "#c98079" }),
        makeRow({ id: "chore-id", name: "chore", color: "#adb9c1" }),
      ];
      mockClientQuery
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: "user-1" }] }) // user lock
        .mockResolvedValueOnce({ rows: [] }) // no existing labels
        .mockResolvedValueOnce({ rows: [seedRows[0]] })
        .mockResolvedValueOnce({ rows: [seedRows[1]] })
        .mockResolvedValueOnce({ rows: [seedRows[2]] })
        .mockResolvedValueOnce(undefined); // COMMIT

      const labels = await ensureSeedLabels("user-1");

      expect(labels.map((label) => label.name)).toEqual(["feature", "bug", "chore"]);
      expect(mockClientQuery).toHaveBeenCalledWith(
        "SELECT id FROM users WHERE id = $1 FOR UPDATE",
        ["user-1"],
      );
      expect(mockPublishEvent).toHaveBeenCalledTimes(3);
    });

    it("does not create defaults when the user already has any label", async () => {
      mockClientQuery
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "user-1" }] })
        .mockResolvedValueOnce({ rows: [{ id: "existing" }] })
        .mockResolvedValueOnce(undefined);

      await expect(ensureSeedLabels("user-1")).resolves.toEqual([]);

      expect(mockClientQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO labels"),
        expect.anything(),
      );
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });
  });

  describe("createLabel", () => {
    it("inserts and returns formatted label", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ id: "fixed-uuid-for-test", name: "my_label", color: "#7dbfb2" })] });

      const label = await createLabel("user-1", { name: "my_label", color: "#7dbfb2" });

      expect(label.id).toBe("fixed-uuid-for-test");
      expect(label.name).toBe("my_label");
      expect(label.color).toBe("#7dbfb2");
    });

    it("throws on duplicate name", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing" }] });

      await expect(createLabel("user-1", { name: "my_label", color: "#65788a" })).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });

    it("throws on empty name", async () => {
      await expect(createLabel("user-1", { name: "", color: "#65788a" })).rejects.toThrow(AppError);
    });

    it("throws on name > 60 chars", async () => {
      await expect(createLabel("user-1", { name: "a".repeat(61), color: "#65788a" })).rejects.toThrow(AppError);
    });

    it("throws on name with special characters", async () => {
      await expect(createLabel("user-1", { name: "my-label!", color: "#65788a" })).rejects.toThrow(AppError);
    });

    it("throws on invalid color", async () => {
      await expect(createLabel("user-1", { name: "valid_name", color: "hotpink" })).rejects.toThrow(AppError);
    });
  });

  describe("updateLabel", () => {
    it("updates and returns label", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // existing check
      mockQuery.mockResolvedValueOnce({ rows: [] }); // duplicate check
      mockQuery.mockResolvedValueOnce({ rows: [makeRow({ name: "updated_name" })] }); // update

      const label = await updateLabel("label-1", "user-1", { name: "updated_name" });

      expect(label.name).toBe("updated_name");
    });

    it("throws on non-existent label", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(updateLabel("nonexistent", "user-1", { name: "new_name" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
      });
    });

    it("throws on conflict with other label name", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // existing check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "other-label" }] }); // duplicate check

      await expect(updateLabel("label-1", "user-1", { name: "existing_name" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("deleteLabel", () => {
    it("deletes label associations and label in transaction", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }); // existing check
      mockConnect.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      const result = await deleteLabel("label-1", "user-1");

      expect(result).toEqual({ success: true });
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM task_labels WHERE label_id = $1",
        ["label-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        "DELETE FROM labels WHERE id = $1",
        ["label-1"],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockRelease).toHaveBeenCalled();
    });

    it("throws on non-existent label", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(deleteLabel("nonexistent", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
