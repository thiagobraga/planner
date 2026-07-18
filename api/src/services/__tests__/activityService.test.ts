import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { listActivity } from "../activityService.js";

beforeEach(() => {
  mockQuery.mockReset();
});

function eventRow(i: number) {
  return {
    id: `e${i}`,
    user_id: "u1",
    collection_id: "p1",
    entity_type: "task",
    entity_id: "t1",
    event_type: "task_created",
    before_data: null,
    after_data: { title: `t${i}` },
    created_at: `2024-06-${String(15 - i).padStart(2, "0")}T00:00:00Z`,
  };
}

describe("listActivity", () => {
  it("returns events ordered by created_at DESC and computes nextCursor when more exist", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => eventRow(i));
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await listActivity("u1");
    expect(result.events).toHaveLength(50);
    expect(result.nextCursor).toBe(result.events[49].createdAt);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/ORDER BY a\.created_at DESC/);
    expect(mockQuery.mock.calls[0][1].at(-1)).toBe(51); // page size + 1
  });

  it("returns nextCursor=null when result fits on one page", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [eventRow(0)] });
    const result = await listActivity("u1");
    expect(result.nextCursor).toBeNull();
    expect(result.events).toHaveLength(1);
  });

  it("verifies collection access before filtering by collection_id", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "p1" }] }) // collection access check
      .mockResolvedValueOnce({ rows: [eventRow(0)] });

    await listActivity("u1", { collectionId: "p1" });
    expect(mockQuery.mock.calls[0][0]).toMatch(/FROM collections/);
    expect(mockQuery.mock.calls[1][0]).toMatch(/a\.collection_id = \$2/);
  });

  it("404s when collection is not accessible", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(listActivity("u1", { collectionId: "p1" })).rejects.toBeInstanceOf(AppError);
  });

  it("applies cursor as a strict upper-bound on created_at", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listActivity("u1", { cursor: "2024-06-01T00:00:00Z" });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/a\.created_at < /);
    expect(mockQuery.mock.calls[0][1]).toContain("2024-06-01T00:00:00Z");
  });
});
