import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { getTodayView, getUpcomingView, getInboxView, localDateInTimezone, addDaysISO } from "../viewService.js";

const userId = "user-1";

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    user_id: userId,
    project_id: "p-1",
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
  it("groups overdue vs today and excludes archived projects", async () => {
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
    expect(sql).toMatch(/is_completed = false/);
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

describe("getInboxView", () => {
  it("returns inbox tasks ordered by order_value ascending", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "inbox-1" }] })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "t1", order_value: 0 }),
          taskRow({ id: "t2", order_value: 1000 }),
        ],
      });

    const view = await getInboxView(userId);
    expect(view.projectId).toBe("inbox-1");
    expect(view.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);

    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toMatch(/ORDER BY order_value ASC/);
    expect(sql).toMatch(/is_completed = false/);
  });

  it("returns empty when user has no Inbox project", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const view = await getInboxView(userId);
    expect(view).toEqual({ tasks: [], projectId: null });
  });
});
