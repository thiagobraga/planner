import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "rem-uuid",
}));

import {
  createReminder,
  listRemindersForTask,
  deleteReminder,
  autoScheduleForTaskDue,
  fetchDueReminders,
  validateRemindAt,
} from "../reminderService.js";

beforeEach(() => {
  mockQuery.mockReset();
});

const now = new Date("2024-06-15T12:00:00Z");

describe("validateRemindAt", () => {
  it("accepts a future ISO datetime", () => {
    expect(() => validateRemindAt("2024-06-15T13:00:00Z", now)).not.toThrow();
  });

  it("rejects non-string inputs", () => {
    expect(() => validateRemindAt(12345 as unknown, now)).toThrow(AppError);
  });

  it("rejects invalid datetimes", () => {
    expect(() => validateRemindAt("not-a-date", now)).toThrow(AppError);
  });

  it("rejects past datetimes", () => {
    expect(() => validateRemindAt("2024-06-15T11:00:00Z", now)).toThrow(AppError);
  });

  it("rejects exactly-now datetimes", () => {
    expect(() => validateRemindAt("2024-06-15T12:00:00Z", now)).toThrow(AppError);
  });
});

describe("createReminder", () => {
  it("verifies task access, validates datetime, and inserts", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ project_id: "p1" }] }) // task access
      .mockResolvedValueOnce({
        rows: [{
          id: "rem-uuid",
          task_id: "t1",
          user_id: "u1",
          remind_at: "2024-06-15T13:00:00.000Z",
          is_fired: false,
          created_at: "2024-06-15T12:00:00Z",
        }],
      });

    const result = await createReminder("t1", "u1", "2024-06-15T13:00:00Z", now);
    expect(result.id).toBe("rem-uuid");
    expect(result.taskId).toBe("t1");

    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO reminders/);
  });

  it("rejects when task is not accessible", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(createReminder("t1", "u1", "2024-06-15T13:00:00Z", now))
      .rejects.toBeInstanceOf(AppError);
  });

  it("rejects past datetime before querying db", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ project_id: "p1" }] });
    await expect(createReminder("t1", "u1", "2024-06-15T11:00:00Z", now))
      .rejects.toBeInstanceOf(AppError);
  });
});

describe("listRemindersForTask", () => {
  it("verifies access then returns reminders ordered by remind_at", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ project_id: "p1" }] })
      .mockResolvedValueOnce({ rows: [] });

    await listRemindersForTask("t1", "u1");
    expect(mockQuery.mock.calls[1][0]).toMatch(/ORDER BY remind_at ASC/);
  });
});

describe("deleteReminder", () => {
  it("scopes by user id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "rem-1" }] });
    await deleteReminder("rem-1", "u1");
    expect(mockQuery.mock.calls[0][1]).toEqual(["rem-1", "u1"]);
  });

  it("404s when not found / not owned", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(deleteReminder("rem-x", "u1")).rejects.toBeInstanceOf(AppError);
  });
});

describe("autoScheduleForTaskDue", () => {
  it("cancels existing then inserts when due is in future", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const future = new Date(Date.now() + 60_000).toISOString();
    await autoScheduleForTaskDue("t1", "u1", future);

    expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM reminders WHERE task_id = \$1 AND is_fired = false/);
    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO reminders/);
  });

  it("only cancels (no insert) when due is in the past", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const past = new Date(Date.now() - 60_000).toISOString();
    await autoScheduleForTaskDue("t1", "u1", past);

    expect(mockQuery.mock.calls).toHaveLength(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/DELETE FROM reminders/);
  });
});

describe("fetchDueReminders", () => {
  it("filters out users with notifications disabled", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "r1", task_id: "t1", user_id: "u1", remind_at: "2024-06-15T12:00:30Z", is_fired: false, created_at: "x", notifications_enabled: true },
        { id: "r2", task_id: "t2", user_id: "u2", remind_at: "2024-06-15T12:00:40Z", is_fired: false, created_at: "x", notifications_enabled: false },
      ],
    });

    const result = await fetchDueReminders(now, 60);
    expect(result.map(r => r.id)).toEqual(["r1"]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/is_fired = false/);
    expect(sql).toMatch(/JOIN preferences/);
  });
});
