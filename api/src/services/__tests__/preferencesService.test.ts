import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();
const mockBuildEvent = vi.fn((input: unknown) => ({ id: "sync-1", emittedAt: "2026-07-11T00:00:00.000Z", ...(input as object) }));
const mockPublishEvent = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("../syncService.js", () => ({
  buildEvent: (input: unknown) => mockBuildEvent(input),
  publishEvent: (event: unknown) => mockPublishEvent(event),
}));

import { getPreferences, updatePreferences, validatePreferences } from "../preferencesService.js";

beforeEach(() => {
  mockQuery.mockReset();
  mockBuildEvent.mockClear();
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});

const prefsRow = {
  user_id: "u1",
  time_zone: "UTC",
  week_start: "sunday",
  theme: "system",
  notifications_enabled: true,
  font: "lora",
  show_dots: true,
  background: "beige",
  small_caps: false,
  hide_completed_tasks: false,
  hide_old_notes: false,
};

describe("validatePreferences", () => {
  it("rejects invalid timezone", () => {
    expect(() => validatePreferences({ timeZone: "Mars/Olympus" })).toThrow(AppError);
  });

  it("accepts valid IANA timezone", () => {
    expect(() => validatePreferences({ timeZone: "America/New_York" })).not.toThrow();
  });

  it("rejects invalid weekStart", () => {
    expect(() => validatePreferences({ weekStart: "wednesday" })).toThrow(AppError);
  });

  it("accepts sunday/monday for weekStart", () => {
    expect(() => validatePreferences({ weekStart: "sunday" })).not.toThrow();
    expect(() => validatePreferences({ weekStart: "monday" })).not.toThrow();
  });

  it("rejects invalid theme", () => {
    expect(() => validatePreferences({ theme: "rainbow" })).toThrow(AppError);
  });

  it("accepts light/dark/system theme", () => {
    expect(() => validatePreferences({ theme: "light" })).not.toThrow();
    expect(() => validatePreferences({ theme: "dark" })).not.toThrow();
    expect(() => validatePreferences({ theme: "system" })).not.toThrow();
  });

  it("rejects non-boolean notificationsEnabled", () => {
    expect(() => validatePreferences({ notificationsEnabled: "yes" as unknown as boolean })).toThrow(AppError);
  });

  it("rejects non-boolean behavior toggles", () => {
    expect(() => validatePreferences({ hideCompletedTasks: "yes" as unknown as boolean })).toThrow(AppError);
    expect(() => validatePreferences({ hideOldNotes: "yes" as unknown as boolean })).toThrow(AppError);
  });

  it("aggregates multiple errors", () => {
    try {
      validatePreferences({ timeZone: "x", theme: "y", weekStart: "z" });
      expect.fail("should throw");
    } catch (e) {
      const err = e as AppError;
      expect(err.details).toHaveLength(3);
    }
  });
});

describe("getPreferences", () => {
  it("returns the preferences row", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [prefsRow] });
    const p = await getPreferences("u1");
    expect(p.timeZone).toBe("UTC");
    expect(p.weekStart).toBe("sunday");
    expect(p.theme).toBe("system");
    expect(p.notificationsEnabled).toBe(true);
    expect(p.hideCompletedTasks).toBe(false);
    expect(p.hideOldNotes).toBe(false);
  });

  it("404s when no preferences", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getPreferences("u1")).rejects.toBeInstanceOf(AppError);
  });
});

describe("updatePreferences", () => {
  it("validates then updates only provided fields", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...prefsRow, theme: "dark" }] });
    const p = await updatePreferences("u1", { theme: "dark" });
    expect(p.theme).toBe("dark");

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/theme = \$1/);
    expect(sql).not.toMatch(/time_zone/);
  });

  it("publishes a user-scoped preferences sync event after update", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...prefsRow, background: "white" }] });

    const p = await updatePreferences("u1", { background: "white" });

    expect(p.background).toBe("white");
    expect(mockBuildEvent).toHaveBeenCalledWith({
      entityType: "preferences",
      eventType: "updated",
      entityId: "u1",
      userId: "u1",
      payload: p,
    });
    expect(mockPublishEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "preferences",
      eventType: "updated",
      entityId: "u1",
      userId: "u1",
      payload: p,
    }));
  });

  it("returns existing prefs when input is empty", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [prefsRow] });
    const p = await updatePreferences("u1", {});
    expect(p.theme).toBe("system");
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT/);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it("updates behavior toggles and publishes the merged payload", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...prefsRow, hide_completed_tasks: true, hide_old_notes: true }] });

    const p = await updatePreferences("u1", { hideCompletedTasks: true, hideOldNotes: true });

    expect(p.hideCompletedTasks).toBe(true);
    expect(p.hideOldNotes).toBe(true);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/hide_completed_tasks = \$1/);
    expect(sql).toMatch(/hide_old_notes = \$2/);
    expect(mockBuildEvent).toHaveBeenCalledWith(expect.objectContaining({ payload: p }));
  });

  it("rejects invalid input before db call", async () => {
    await expect(updatePreferences("u1", { theme: "neon" })).rejects.toBeInstanceOf(AppError);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
