import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { getInboxView, getCollectionView, localDateInTimezone, addDaysISO } from "../viewService.js";

const userId = "user-1";
const visibilityPrefsRow = { rows: [{ time_zone: "UTC", hide_completed_tasks: false, show_notes: true }] };

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

describe("getInboxView", () => {
  it("returns inbox tasks in stored manual order, interleaving completed rows", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ time_zone: "UTC", hide_completed_tasks: false, show_notes: true }],
    })
    // inbox collection result
    .mockResolvedValueOnce({ rows: [{ id: "p-1" }] })
    .mockResolvedValueOnce({
      rows: [
        taskRow({ id: "done", collection_id: "p-2", is_completed: true, priority: 4, order_value: 1000, created_at: "2024-06-02T00:00:00Z" }),
        taskRow({ id: "open", collection_id: "p-1", is_completed: false, priority: 1, order_value: 2000, created_at: "2024-06-01T00:00:00Z" }),
      ],
    })
    // listSections: verifyCollectionAccess + sections select
    .mockResolvedValueOnce({ rows: [{ id: "p-1" }] })
    .mockResolvedValueOnce({ rows: [] })
    // attachLabels
    .mockResolvedValueOnce({ rows: [] })
    // board metadata
    .mockResolvedValueOnce({
      rows: [{
        id: "status-1", collection_id: "p-1", name: "Todo", color: "#adb9c1",
        completion_status_id: "status-completed", order_value: 1000, created_at: "2024-06-01T00:00:00Z",
        updated_at: "2024-06-01T00:00:00Z",
      }],
    })
    .mockResolvedValueOnce({
      rows: [
        { task_id: "done", scope_type: "status", position: 2000 },
        { task_id: "open", scope_type: "priority", position: 500 },
      ],
    });

    const view = await getInboxView(userId);
    expect(view.collectionId).toBeNull();
    expect(view.tasks.map((t) => t.id)).toEqual(["done", "open"]);
    expect(view.statuses[0]).toEqual(expect.objectContaining({ id: "status-1", name: "Todo" }));
    expect(view.completionStatusId).toBe("status-completed");
    expect(view.boardOrder).toEqual({ status: { done: 2000 }, priority: { open: 500 } });

    const sql = mockQuery.mock.calls[2][0] as string;
    expect(sql).toMatch(/JOIN collections p ON p\.id = t\.collection_id/);
    expect(sql).toMatch(/p\.is_inbox = true/);
    expect(sql).toMatch(/is_archived = false/);
    expect(sql).toMatch(/t\.is_completed = false/);
    expect(sql).toMatch(/t\.type = 'note'/);
    expect(sql).toMatch(/ORDER BY t\.order_value ASC, t\.created_at ASC/);
    expect(sql).not.toMatch(/ORDER BY[^`]*(is_completed|priority)/);
  });

  it("returns empty when there are no accessible tasks", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
      // inbox collection result (none accessible)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const view = await getInboxView(userId);
    expect(view).toEqual({
      tasks: [],
      collectionId: null,
      inboxCollectionId: undefined,
      sections: [],
      statuses: [],
      completionStatusId: null,
      boardOrder: { status: {}, priority: {} },
    });
  });

  it("attaches labels to inbox tasks in one query", async () => {
    mockQuery
      .mockResolvedValueOnce(visibilityPrefsRow)
      .mockResolvedValueOnce({ rows: [{ id: "p-1" }] })
      .mockResolvedValueOnce({ rows: [taskRow({ id: "inbox-labeled" })] })
      .mockResolvedValueOnce({ rows: [{ id: "p-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { task_id: "inbox-labeled", id: "l-1", user_id: userId, name: "bug", color: "#c98079", created_at: "2024-06-01T00:00:00Z", updated_at: "2024-06-01T00:00:00Z" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const view = await getInboxView(userId);

    expect(view.tasks[0]?.labels).toEqual([
      { id: "l-1", userId, name: "bug", color: "#c98079", createdAt: "2024-06-01T00:00:00Z", updatedAt: "2024-06-01T00:00:00Z" },
    ]);
    expect(mockQuery.mock.calls[5][0]).toMatch(/JOIN labels l ON l\.id = tl\.label_id/);
  });
});

describe("getCollectionView", () => {
  it("returns completed tasks on collection pages interleaved in stored manual order", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ time_zone: "UTC", hide_completed_tasks: false, show_notes: true }] })
      .mockResolvedValueOnce({
        rows: [{ id: "c-1", name: "Work", color: "#7dbfb2", is_inbox: false }],
      })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "done", is_completed: true, order_value: 1000, created_at: "2024-06-02T00:00:00Z" }),
          taskRow({ id: "open", is_completed: false, order_value: 2000, created_at: "2024-06-01T00:00:00Z" }),
        ],
      })
      // listSections: verifyCollectionAccess + sections select
      .mockResolvedValueOnce({ rows: [{ id: "c-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      // attachLabels
      .mockResolvedValueOnce({ rows: [] })
      // board metadata
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const view = await getCollectionView(userId, "c-1");

    expect(view.collection).toEqual({
      id: "c-1",
      name: "Work",
      color: "#7dbfb2",
      isInbox: false,
    });
    expect(view.collectionId).toBe("c-1");
    expect(view.tasks.map((t) => t.id)).toEqual(["done", "open"]);

    const sql = mockQuery.mock.calls[2][0] as string;
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT time_zone, hide_completed_tasks, show_notes/);
    expect(sql).toMatch(/FROM tasks/);
    expect(sql).toMatch(/is_completed = false/);
    expect(sql).toMatch(/type = 'note'/);
    expect(sql).toMatch(/ORDER BY order_value ASC, created_at ASC/);
  });

  it("attaches each task's labels in one query", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ time_zone: "UTC", hide_completed_tasks: false, show_notes: true }] })
      .mockResolvedValueOnce({ rows: [{ id: "c-1", name: "Work", color: "#7dbfb2", is_inbox: false }] })
      .mockResolvedValueOnce({
        rows: [
          taskRow({ id: "t-labeled" }),
          taskRow({ id: "t-bare", order_value: 1 }),
        ],
      })
      // listSections
      .mockResolvedValueOnce({ rows: [{ id: "c-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      // attachLabels join
      .mockResolvedValueOnce({
        rows: [
          { task_id: "t-labeled", id: "l-1", user_id: userId, name: "bug", color: "#c98079", created_at: "2024-06-01T00:00:00Z", updated_at: "2024-06-01T00:00:00Z" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const view = await getCollectionView(userId, "c-1");

    const labeled = view.tasks.find((t) => t.id === "t-labeled");
    const bare = view.tasks.find((t) => t.id === "t-bare");
    expect(labeled?.labels).toEqual([
      { id: "l-1", userId, name: "bug", color: "#c98079", createdAt: "2024-06-01T00:00:00Z", updatedAt: "2024-06-01T00:00:00Z" },
    ]);
    expect(bare?.labels).toEqual([]);

    const labelsSql = mockQuery.mock.calls[5][0] as string;
    expect(labelsSql).toMatch(/JOIN labels l ON l\.id = tl\.label_id/);
  });
});
