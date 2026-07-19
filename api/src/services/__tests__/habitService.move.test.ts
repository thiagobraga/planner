import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

vi.mock("../../db/pool.js", () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../syncService.js", () => ({
  buildEvent: (e: unknown) => e,
  publishEvent: () => Promise.resolve(),
}));

import { moveHabit, moveHabitGroup } from "../habitService.js";
import pool from "../../db/pool.js";

const userId = "u1";
const habitId = "h1";

function habitRow(over: Record<string, unknown> = {}) {
  return {
    id: habitId,
    user_id: userId,
    name: "Water",
    parent_id: null,
    group_id: null,
    order_value: 0,
    ...over,
  };
}

/**
 * Records every statement the transaction issues. `rowsFor` answers SELECTs by
 * matching on SQL text, in the order the move issues them.
 */
function mockTransaction(rowsFor: Array<[RegExp, unknown[]]> = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [pattern, rows] of rowsFor) {
      if (pattern.test(sql)) return { rows };
    }
    return { rows: [] };
  });
  const release = vi.fn();
  (pool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({ query, release });
  return { calls, query, release };
}

async function expectRejection(promise: Promise<unknown>, field: string, message: RegExp): Promise<void> {
  await expect(promise).rejects.toThrow(AppError);
  const err = await promise.catch((e: AppError) => e);
  const details = (err as AppError & { details?: Array<{ field: string; message: string }> }).details;
  expect(details?.[0]?.field).toBe(field);
  expect(details?.[0]?.message).toMatch(message);
}

beforeEach(() => {
  (pool.query as ReturnType<typeof vi.fn>).mockReset();
  (pool.connect as ReturnType<typeof vi.fn>).mockReset();
});

describe("moveHabit validation", () => {
  it("rejects a negative position", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [habitRow()] });
    await expectRejection(
      moveHabit(userId, habitId, { parentId: null, groupId: null, position: -1 }),
      "position",
      /non-negative/,
    );
  });

  it("rejects self-parenting", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [habitRow()] });
    await expectRejection(
      moveHabit(userId, habitId, { parentId: habitId, groupId: null, position: 0 }),
      "parentId",
      /own parent/,
    );
  });

  it("rejects a habit that doesn't belong to the user", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
    await expect(moveHabit(userId, habitId, { parentId: null, groupId: null, position: 0 })).rejects.toThrow(
      AppError,
    );
  });
});

describe("moveHabit", () => {
  it("rejects making a parent-with-children a sub-habit", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [habitRow()] }); // getOwnedHabit
    mockTransaction([
      [/SELECT \* FROM habits WHERE id = \$1 AND user_id = \$2 FOR UPDATE/, [habitRow({ id: "parent1", parent_id: null })]],
      [/SELECT 1 FROM habits WHERE parent_id = \$1/, [{ x: 1 }]], // hasChildren(habitId) -> true
    ]);

    await expectRejection(
      moveHabit(userId, habitId, { parentId: "parent1", groupId: null, position: 0 }),
      "parentId",
      /with sub-habits cannot become a sub-habit/,
    );
  });

  it("rejects a parent that is itself a sub-habit", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [habitRow()] });
    mockTransaction([
      [/SELECT \* FROM habits WHERE id = \$1 AND user_id = \$2 FOR UPDATE/, [habitRow({ id: "parent1", parent_id: "grandparent" })]],
    ]);

    await expectRejection(
      moveHabit(userId, habitId, { parentId: "parent1", groupId: null, position: 0 }),
      "parentId",
      /sub-habits of their own/,
    );
  });

  it("reorders roots within the ungrouped scope", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow()] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [habitRow()] }); // final moved fetch
    const { calls } = mockTransaction([
      [/SELECT id FROM habits WHERE parent_id IS NULL AND group_id IS NOT DISTINCT FROM \$1.*ORDER BY order_value/, [{ id: "h2" }, { id: "h3" }]],
    ]);

    await moveHabit(userId, habitId, { parentId: null, groupId: null, position: 1 });

    const update = calls.find((c) => /UPDATE habits SET order_value/.test(c.sql) && c.params[1] === habitId);
    expect(update?.params).toEqual([1000, habitId]);
  });

  it("clears groupId and seeds completions when a root becomes a sub-habit", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow({ group_id: "g1" })] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [habitRow({ id: "parent1" })] }); // final moved fetch
    const { calls } = mockTransaction([
      [/SELECT \* FROM habits WHERE id = \$1 AND user_id = \$2 FOR UPDATE/, [habitRow({ id: "parent1", parent_id: null })]],
      [/SELECT 1 FROM habits WHERE parent_id = \$1/, []], // hasChildren(habitId) -> false
    ]);

    await moveHabit(userId, habitId, { parentId: "parent1", groupId: null, position: 0 });

    const update = calls.find((c) => /UPDATE habits SET parent_id/.test(c.sql));
    expect(update?.params).toEqual(["parent1", null, habitId]);

    const seed = calls.find((c) => /INSERT INTO habit_completions/.test(c.sql));
    expect(seed?.params).toEqual([habitId, "parent1"]);
  });

  it("moves a root into a named group (Journaling into Morning Routine)", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow({ name: "Journaling" })] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [habitRow({ name: "Journaling", group_id: "morning-routine" })] }); // final moved fetch
    const { calls } = mockTransaction([
      [/SELECT id FROM habit_groups WHERE id = \$1 AND user_id = \$2/, [{ id: "morning-routine" }]],
      [/SELECT id FROM habits WHERE parent_id IS NULL AND group_id IS NOT DISTINCT FROM \$1.*ORDER BY order_value/, [{ id: "stretch" }]],
    ]);

    await moveHabit(userId, habitId, { parentId: null, groupId: "morning-routine", position: 0 });

    const update = calls.find((c) => /UPDATE habits SET parent_id/.test(c.sql));
    expect(update?.params).toEqual([null, "morning-routine", habitId]);
  });

  it("reorders a sub-habit among its siblings under the same parent", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow({ parent_id: "parent1" })] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [habitRow({ parent_id: "parent1" })] }); // final moved fetch
    const { calls } = mockTransaction([
      [/SELECT \* FROM habits WHERE id = \$1 AND user_id = \$2 FOR UPDATE/, [habitRow({ id: "parent1", parent_id: null })]],
      [/SELECT 1 FROM habits WHERE parent_id = \$1/, []], // hasChildren(habitId) -> false
      [/SELECT id FROM habits WHERE parent_id = \$1 AND id != \$2/, [{ id: "sib1" }, { id: "sib2" }]],
    ]);

    await moveHabit(userId, habitId, { parentId: "parent1", groupId: null, position: 2 });

    // Same parent before and after, so the source scope is never renumbered a
    // second time - only one renumbering pass touches the shared sibling list.
    const normalizeCalls = calls.filter(
      (c) => /SELECT id FROM habits WHERE parent_id = \$1 ORDER BY/.test(c.sql),
    );
    expect(normalizeCalls).toHaveLength(0);

    const update = calls.find((c) => /UPDATE habits SET order_value/.test(c.sql) && c.params[1] === habitId);
    expect(update?.params).toEqual([2000, habitId]);
  });

  it("promotes a sub-habit to a root in a target group", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow({ parent_id: "parent1", group_id: null })] }) // getOwnedHabit
      .mockResolvedValueOnce({ rows: [habitRow({ parent_id: null, group_id: "g1" })] }); // final moved fetch
    const { calls } = mockTransaction([
      [/SELECT id FROM habit_groups WHERE id = \$1 AND user_id = \$2/, [{ id: "g1" }]],
      [/SELECT id FROM habits WHERE parent_id IS NULL AND group_id IS NOT DISTINCT FROM \$1.*ORDER BY order_value/, []],
      [/SELECT id FROM habits WHERE parent_id = \$1 ORDER BY order_value/, [{ id: "sib1" }]], // old parent scope normalized
    ]);

    await moveHabit(userId, habitId, { parentId: null, groupId: "g1", position: 0 });

    const update = calls.find((c) => /UPDATE habits SET parent_id/.test(c.sql));
    expect(update?.params).toEqual([null, "g1", habitId]);

    const normalize = calls.find(
      (c) => /UPDATE habits SET order_value/.test(c.sql) && c.params[1] === "sib1",
    );
    expect(normalize?.params).toEqual([0, "sib1"]);
  });

  it("never updates a child row when its parent moves - the child follows implicitly", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: [habitRow()] }) // getOwnedHabit (root with children)
      .mockResolvedValueOnce({ rows: [habitRow(), habitRow({ id: "child1", parent_id: habitId })] }); // moved fetch
    const { calls } = mockTransaction([
      [/SELECT id FROM habit_groups WHERE id = \$1 AND user_id = \$2/, [{ id: "g2" }]],
    ]);

    await moveHabit(userId, habitId, { parentId: null, groupId: "g2", position: 0 });

    const childUpdate = calls.find(
      (c) => /UPDATE habits SET/.test(c.sql) && c.params.includes("child1"),
    );
    expect(childUpdate).toBeUndefined();
  });

  it("rolls back and rethrows when the transaction fails partway through", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [habitRow()] }); // getOwnedHabit
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (/UPDATE habits SET parent_id/.test(sql)) throw new Error("db exploded");
      return { rows: [] };
    });
    const release = vi.fn();
    (pool.connect as ReturnType<typeof vi.fn>).mockResolvedValue({ query, release });

    await expect(moveHabit(userId, habitId, { parentId: null, groupId: null, position: 0 })).rejects.toThrow(
      "db exploded",
    );

    expect(calls.some((c) => c.sql === "ROLLBACK")).toBe(true);
    expect(release).toHaveBeenCalled();
  });
});

describe("moveHabitGroup", () => {
  it("rejects a negative position", async () => {
    await expectRejection(moveHabitGroup(userId, "g1", { position: -1 }), "position", /non-negative/);
  });

  it("renumbers all of the user's groups with the moved group inserted", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [{ id: "g1", name: "Morning", order_value: 0 }] });
    const { calls } = mockTransaction([
      [/SELECT id FROM habit_groups WHERE user_id = \$1 AND id != \$2/, [{ id: "g2" }, { id: "g3" }]],
    ]);

    await moveHabitGroup(userId, "g1", { position: 1 });

    const update = calls.find((c) => /UPDATE habit_groups SET order_value/.test(c.sql) && c.params[1] === "g1");
    expect(update?.params).toEqual([1000, "g1"]);
  });
});
