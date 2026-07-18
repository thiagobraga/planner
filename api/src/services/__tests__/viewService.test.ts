import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { getTodayView, getUpcomingView, getInboxView, getMonthView, getCollectionView, localDateInTimezone, addDaysISO } from "../viewService.js";

const userId = "user-1";

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    user_id: userId,
    collection_id: "p-1",
    section_id: null,
    parent_task_id: null,
    assignee_user_id: null,
    title: "Test",
    description: null,
    priority: 4,
    due_date: "2024-06-15",
    due_time: null,
    due_timezone: null,
    recurrence_rule: null,
    is_completed: false,
    completed_at: null,
    order_value: 0,
    depth: 0,
    type: "task",
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("viewService helpers", () => {
  it("localDateInTimezone returns YYYY-MM-DD in given timezone", () => {
    const d = new Date("2024-06-15T03:00:00Z");
    expect(localDateInTimezone(d, "UTC")).toBe("2024-06-15");
    // 03:00 UTC == 23:00 previous day in New York
    expect(localDateInTimezone(d, "America/New_York")).toBe("2024-06-14");
  });

  it("addDaysISO advances by N days across month boundaries", () => {
    expect(addDaysISO("2024-01-30", 5)).toBe("2024-02-04");
    expect(addDaysISO("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDaysISO("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("getTodayView", () => {
  it("groups overdue vs today and excludes archived collections", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ time_zone: "UTC" }] }) // preferences
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "old", due_date: "2024-06-10" }),
          taskRow({ id: "today1", due_date: "2024-06-15", priority: 1 }),
          taskRow({ id: "today2", due_date: "2024-06-15", priority: 2 }),
        ],
      });

    const view = await getTodayView(userId, new Date("2024-06-15T12:00:00Z"));

    expect(view.date).toBe("2024-06-15");
    expect(view.overdue.map((t) => t.id)).toEqual(["old"]);
    expect(view.today.map((t) => t.id)).toEqual(["today1", "today2"]);

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/is_archived = false/);
    expect(sql).toMatch(/ORDER BY t\.priority ASC, t\.order_value ASC/);
  });

  it("uses user's timezone for today determination", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ time_zone: "America/New_York" }] })
      .mockResolvedValueOnce({ rows: [] });

    const view = await getTodayView(userId, new Date("2024-06-15T03:00:00Z"));
    expect(view.date).toBe("2024-06-14");
  });

  it("defaults to UTC when no preferences row", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const view = await getTodayView(userId, new Date("2024-06-15T12:00:00Z"));
    expect(view.date).toBe("2024-06-15");
  });
});

describe("getUpcomingView", () => {
  it("rejects days outside 7-30", async () => {
    await expect(getUpcomingView(userId, 6)).rejects.toBeInstanceOf(AppError);
    await expect(getUpcomingView(userId, 31)).rejects.toBeInstanceOf(AppError);
    await expect(getUpcomingView(userId, 7.5)).rejects.toBeInstanceOf(AppError);
  });

  it("groups tasks by day within the range", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ time_zone: "UTC" }] })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "a", due_date: "2024-06-15" }),
          taskRow({ id: "b", due_date: "2024-06-17" }),
          taskRow({ id: "c", due_date: "2024-06-17", priority: 1 }),
        ],
      });

    const view = await getUpcomingView(userId, 7, new Date("2024-06-15T12:00:00Z"));

    expect(view.start).toBe("2024-06-15");
    expect(view.end).toBe("2024-06-21");
    expect(view.days).toHaveLength(7);
    expect(view.days[0]).toEqual({ date: "2024-06-15", tasks: expect.arrayContaining([expect.objectContaining({ id: "a" })]) });
    expect(view.days[2].tasks.map((t) => t.id)).toEqual(["b", "c"]);
    expect(view.days[1].tasks).toEqual([]);
  });
});

describe("getMonthView", () => {
  it("rejects invalid year or month", async () => {
    await expect(getMonthView(userId, 2024, 0)).rejects.toBeInstanceOf(AppError);
    await expect(getMonthView(userId, 2024, 13)).rejects.toBeInstanceOf(AppError);
    await expect(getMonthView(userId, 1.5, 6)).rejects.toBeInstanceOf(AppError);
  });

  it("groups note rows and saved descriptions by due date", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        taskRow({ id: "n1", type: "note", due_date: "2024-06-05" }),
        taskRow({ id: "n2", type: "note", due_date: "2024-06-05" }),
        taskRow({ id: "d1", type: "task", description: "Saved note", due_date: "2024-06-05" }),
        taskRow({ id: "n3", type: "note", due_date: "2024-06-20" }),
      ],
    });

    const view = await getMonthView(userId, 2024, 6);

    expect(view.notesByDate["2024-06-05"].map((t) => t.id)).toEqual(["n1", "n2", "d1"]);
    expect(view.notesByDate["2024-06-20"].map((t) => t.id)).toEqual(["n3"]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/t\.type = 'note'/);
    expect(sql).toMatch(/t\.description/);
    expect(sql).toMatch(/is_archived = false/);
  });

  it("excludes notes from adjacent months via the query date range", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getMonthView(userId, 2024, 6);

    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual([userId, "2024-06-01", "2024-06-30"]);
  });

  it("computes the correct last day of the month, including leap February and December", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getMonthView(userId, 2024, 2); // leap year
    expect((mockQuery.mock.calls[0][1] as string[])[2]).toBe("2024-02-29");

    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getMonthView(userId, 2023, 2); // non-leap year
    expect((mockQuery.mock.calls[1][1] as string[])[2]).toBe("2023-02-28");

    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getMonthView(userId, 2024, 12);
    expect((mockQuery.mock.calls[2][1] as string[])[2]).toBe("2024-12-31");
  });
});

describe("getInboxView", () => {
  it("returns inbox tasks ordered by completion, priority, then creation time", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        taskRow({ id: "done", collection_id: "p-2", is_completed: true, priority: 4, created_at: "2024-06-02T00:00:00Z" }),
        taskRow({ id: "open", collection_id: "p-1", is_completed: false, priority: 1, created_at: "2024-06-01T00:00:00Z" }),
      ],
    });

    const view = await getInboxView(userId);
    expect(view.collectionId).toBeNull();
    expect(view.tasks.map((t) => t.id)).toEqual(["done", "open"]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/JOIN collections p ON p\.id = t\.collection_id/);
    expect(sql).toMatch(/p\.is_inbox = true/);
    expect(sql).toMatch(/is_archived = false/);
    expect(sql).toMatch(/ORDER BY t\.is_completed ASC, t\.priority ASC, t\.created_at ASC/);
  });

  it("returns empty when there are no accessible tasks", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const view = await getInboxView(userId);
    expect(view).toEqual({ tasks: [], collectionId: null });
  });
});

describe("getCollectionView", () => {
  it("returns completed tasks on collection pages and sorts them after open tasks", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: "c-1", name: "Work", color: "green", is_inbox: false }],
      })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "open", is_completed: false, order_value: 1, created_at: "2024-06-01T00:00:00Z" }),
          taskRow({ id: "done", is_completed: true, order_value: 0, created_at: "2024-06-02T00:00:00Z" }),
        ],
      });

    const view = await getCollectionView(userId, "c-1");

    expect(view.collection).toEqual({
      id: "c-1",
      name: "Work",
      color: "green",
      isInbox: false,
    });
    expect(view.collectionId).toBe("c-1");
    expect(view.tasks.map((t) => t.id)).toEqual(["open", "done"]);

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/FROM tasks/);
    expect(sql).toMatch(/ORDER BY is_completed ASC, order_value ASC, created_at ASC/);
    expect(sql).not.toMatch(/is_completed = false/);
  });
});
