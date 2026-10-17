import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();
const mockRevokeAllUserSessions = vi.fn();
const mockRevokeAllUserTokens = vi.fn();
const mockRevokeAllUserGrants = vi.fn();
const mockSessionRevoked = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("../sessionService.js", () => ({
  revokeAllUserSessions: (...args: unknown[]) => mockRevokeAllUserSessions(...args),
}));

vi.mock("../apiTokenService.js", () => ({
  revokeAllUserTokens: (...args: unknown[]) => mockRevokeAllUserTokens(...args),
}));

vi.mock("../oauthService.js", () => ({
  revokeAllUserGrants: (...args: unknown[]) => mockRevokeAllUserGrants(...args),
}));

vi.mock("../../utils/securityLogger.js", () => ({
  securityLog: {
    sessionRevoked: (...args: unknown[]) => mockSessionRevoked(...args),
  },
}));

import { exportUserData, deleteUserAccount } from "../accountService.js";

const NOW = new Date("2026-08-07T12:00:00.000Z");

beforeEach(() => {
  mockQuery.mockReset();
  mockRevokeAllUserSessions.mockReset();
  mockRevokeAllUserTokens.mockReset();
  mockRevokeAllUserGrants.mockReset();
  mockSessionRevoked.mockReset();
  mockRevokeAllUserSessions.mockResolvedValue(undefined);
  mockRevokeAllUserTokens.mockResolvedValue(undefined);
  mockRevokeAllUserGrants.mockResolvedValue(undefined);
});

describe("exportUserData", () => {
  it("returns all user data categories and excludes sensitive fields", async () => {
    mockQuery
      // 1. users
      .mockResolvedValueOnce({
        rows: [
          {
            id: "u1",
            email: "alice@example.com",
            display_name: "Alice",
            password_hash: "$argon2id$secret",
            created_at: NOW,
          },
        ],
      })
      // 2. preferences
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: "u1",
            time_zone: "America/Sao_Paulo",
            week_start: "monday",
            theme: "light",
            notifications_enabled: true,
            font: "lora",
            show_dots: true,
            background: "beige",
            small_caps: false,
            hide_completed_tasks: false,
            show_notes: true,
            agent_change_notices: true,
            locale: "pt-BR",
            date_format: "DD/MM ddd",
          },
        ],
      })
      // 3. collections
      .mockResolvedValueOnce({
        rows: [
          {
            id: "c1",
            parent_id: null,
            name: "Inbox",
            color: "#bababa",
            is_inbox: true,
            is_archived: false,
            order_value: 0,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 4. tasks
      .mockResolvedValueOnce({
        rows: [
          {
            id: "t1",
            collection_id: "c1",
            section_id: "s1",
            parent_task_id: null,
            title: "Read privacy policy",
            description: "Check GDPR & LGPD sections",
            priority: 2,
            due_date: "2026-08-07",
            due_time: "09:00:00+00",
            due_timezone: "UTC",
            deadline_date: null,
            deadline_time: null,
            deadline_timezone: null,
            duration_minutes: 30,
            recurrence_rule: null,
            is_completed: false,
            completed_at: null,
            order_value: 1,
            depth: 0,
            type: "task",
            status_id: null,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 5. labels
      .mockResolvedValueOnce({
        rows: [
          {
            id: "l1",
            name: "legal",
            color: "#c9483b",
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 6. sections
      .mockResolvedValueOnce({
        rows: [
          {
            id: "s1",
            collection_id: "c1",
            name: "Backlog",
            order_value: 0,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 7. habits
      .mockResolvedValueOnce({
        rows: [
          {
            id: "h1",
            name: "Drink water",
            order_value: 0,
            parent_id: null,
            group_id: null,
            archived_at: null,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 8. habit_completions
      .mockResolvedValueOnce({
        rows: [
          {
            habit_id: "h1",
            completed_date: "2026-08-07",
            created_at: NOW,
          },
        ],
      })
      // 9. filters
      .mockResolvedValueOnce({
        rows: [
          {
            id: "f1",
            name: "Urgent",
            query: "p1",
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      })
      // 10. comments
      .mockResolvedValueOnce({
        rows: [
          {
            id: "cm1",
            task_id: "t1",
            body: "Looks good",
            created_at: NOW,
            updated_at: null,
          },
        ],
      })
      // 11. reminders
      .mockResolvedValueOnce({
        rows: [
          {
            id: "r1",
            task_id: "t1",
            remind_at: NOW,
            is_fired: false,
            created_at: NOW,
          },
        ],
      });

    const exported = await exportUserData("u1");

    expect(exported.user).toEqual({
      email: "alice@example.com",
      displayName: "Alice",
      createdAt: "2026-08-07T12:00:00.000Z",
    });
    expect(exported.user).not.toHaveProperty("password_hash");
    expect(exported.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(exported)).not.toContain("argon2id");

    expect(exported.preferences).toEqual({
      timeZone: "America/Sao_Paulo",
      weekStart: "monday",
      theme: "light",
      notificationsEnabled: true,
      font: "lora",
      showDots: true,
      background: "beige",
      smallCaps: false,
      hideCompletedTasks: false,
      showNotes: true,
      agentChangeNotices: true,
      locale: "pt-BR",
      dateFormat: "DD/MM ddd",
    });
    expect(exported.collections).toHaveLength(1);
    expect(exported.collections[0]?.name).toBe("Inbox");
    expect(exported.tasks).toHaveLength(1);
    expect(exported.tasks[0]?.title).toBe("Read privacy policy");
    expect(exported.labels).toHaveLength(1);
    expect(exported.sections).toHaveLength(1);
    expect(exported.habits).toHaveLength(1);
    expect(exported.habitCompletions).toHaveLength(1);
    expect(exported.filters).toHaveLength(1);
    expect(exported.comments).toHaveLength(1);
    expect(exported.reminders).toHaveLength(1);
  });

  it("throws 404 NOT_FOUND when the user does not exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await expect(exportUserData("missing-user")).rejects.toThrow(AppError);
    await expect(exportUserData("missing-user")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});

describe("deleteUserAccount", () => {
  it("revokes sessions, tokens, and grants, then deletes the user record", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "u1" }] });

    await deleteUserAccount("u1");

    expect(mockRevokeAllUserSessions).toHaveBeenCalledWith("u1", "account-deleted");
    expect(mockRevokeAllUserTokens).toHaveBeenCalledWith("u1", "account-deleted");
    expect(mockRevokeAllUserGrants).toHaveBeenCalledWith("u1", "account-deleted");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM users WHERE id = $1"),
      ["u1"],
    );
    expect(mockSessionRevoked).toHaveBeenCalledWith("u1", "account-deleted", "u1");
  });

  it("throws 404 NOT_FOUND when the user does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(deleteUserAccount("missing-user")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});
