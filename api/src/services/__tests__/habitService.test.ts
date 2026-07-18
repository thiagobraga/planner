import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("../syncService.js", () => ({
  buildEvent: (e: unknown) => e,
  publishEvent: () => Promise.resolve(),
}));

import {
  createHabit,
  updateHabit,
  toggleCompletion,
  deleteGroup,
} from "../habitService.js";

beforeEach(() => {
  mockQuery.mockReset();
});

function habitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "h1",
    user_id: "u1",
    name: "Beber 4L d'água",
    parent_id: null,
    group_id: null,
    order_value: 0,
    ...overrides,
  };
}

describe("createHabit", () => {
  it("rejects a parent that is itself a sub-habit", async () => {
    // getOwnedHabit(parent) -> the proposed parent is already a child
    mockQuery.mockResolvedValueOnce({ rows: [habitRow({ id: "h2", parent_id: "h1" })] });

    await expect(createHabit("u1", { name: "1L", parentId: "h2" })).rejects.toThrow(AppError);
    // Rejected before reaching the INSERT.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a parent owned by another user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // getOwnedHabit finds nothing

    await expect(createHabit("u1", { name: "1L", parentId: "h9" })).rejects.toThrow(AppError);
  });

  it("clears groupId on a sub-habit so it inherits its parent's group", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [habitRow()] }) // validateParent
      .mockResolvedValueOnce({ rows: [habitRow({ id: "h3", parent_id: "h1" })] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // seed completions from parent

    const habit = await createHabit("u1", { name: "1L", parentId: "h1", groupId: "g1" });

    // The group lookup never runs, and NULL is what reaches the INSERT.
    const insertParams = mockQuery.mock.calls[1]?.[1] as unknown[];
    expect(insertParams[3]).toBeNull();
    expect(habit.parentId).toBe("h1");
    expect(habit.groupId).toBeNull();
  });

  it("inherits the parent's own completions so those days stay full", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [habitRow()] }) // validateParent
      .mockResolvedValueOnce({ rows: [habitRow({ id: "h3", parent_id: "h1" })] }) // insert
      .mockResolvedValueOnce({ rows: [{ iso: "2026-07-13" }, { iso: "2026-07-14" }] }); // seed

    const habit = await createHabit("u1", { name: "1L", parentId: "h1" });

    expect(habit.completions).toEqual(["2026-07-13", "2026-07-14"]);
    expect(mockQuery.mock.calls[2]?.[0]).toMatch(/INSERT INTO habit_completions/);
    expect(mockQuery.mock.calls[2]?.[1]).toEqual(["h3", "h1"]);
  });

  it("does not seed completions for a root habit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [habitRow()] }); // insert only

    const habit = await createHabit("u1", { name: "Journal" });

    expect(habit.completions).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("validates group ownership for a root habit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // getOwnedGroup finds nothing

    await expect(createHabit("u1", { name: "Remédios", groupId: "g9" })).rejects.toThrow(AppError);
  });
});

describe("toggleCompletion", () => {
  it("refuses to store a completion on a habit that has sub-habits", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [habitRow()] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // hasChildren -> yes

    await expect(toggleCompletion("u1", "h1", "2026-07-18", true)).rejects.toThrow(
      /derived from its sub-habits/,
    );
    // No INSERT was attempted.
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("stores a completion for a leaf habit", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [habitRow({ id: "h3", parent_id: "h1" })] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [] }) // hasChildren -> no
      .mockResolvedValueOnce({ rows: [] }); // insert

    const result = await toggleCompletion("u1", "h3", "2026-07-18", true);

    expect(result).toEqual({ habitId: "h3", date: "2026-07-18", isCompleted: true });
    expect(mockQuery.mock.calls[2]?.[0]).toMatch(/INSERT INTO habit_completions/);
  });

  it("rejects a malformed date before touching the database", async () => {
    await expect(toggleCompletion("u1", "h1", "18/07/2026", true)).rejects.toThrow(AppError);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("updateHabit", () => {
  it("refuses to nest a habit that already has sub-habits", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // hasChildren -> yes

    await expect(updateHabit("u1", "h1", { parentId: "h2" })).rejects.toThrow(
      /cannot become a sub-habit/,
    );
  });

  it("refuses to make a habit its own parent", async () => {
    await expect(updateHabit("u1", "h1", { parentId: "h1" })).rejects.toThrow(AppError);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("refuses to group a sub-habit directly", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [habitRow({ id: "h3", parent_id: "h1" })] }); // getOwnedHabit

    await expect(updateHabit("u1", "h3", { groupId: "g1" })).rejects.toThrow(
      /belongs to its parent's group/,
    );
  });

  it("renames without touching hierarchy columns", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [habitRow({ name: "Beber 3L d'água" })] });

    const habit = await updateHabit("u1", "h1", { name: "Beber 3L d'água" });

    expect(habit.name).toBe("Beber 3L d'água");
    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).not.toMatch(/parent_id/);
    expect(sql).not.toMatch(/group_id/);
  });
});

describe("deleteGroup", () => {
  it("throws NOT_FOUND when the group does not belong to the user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteGroup("u1", "g9")).rejects.toThrow(AppError);
  });

  it("deletes the group and leaves its habits to be ungrouped by the FK", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "g1" }] });

    await expect(deleteGroup("u1", "g1")).resolves.toBeUndefined();
    // Only the group row is touched; no UPDATE on habits.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]?.[0]).toMatch(/DELETE FROM habit_groups/);
  });
});
