import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("uuid", () => ({ v4: () => "c-uuid" }));

import { listComments, createComment, updateComment, deleteComment } from "../commentService.js";

beforeEach(() => {
  mockQuery.mockReset();
});

function taskRow(userId = "owner") {
  return { user_id: userId, project_id: "p1" };
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    task_id: "t1",
    user_id: "author",
    body: "hello",
    created_at: "2024-06-15T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

describe("listComments", () => {
  it("verifies access and returns ordered by created_at asc", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [] });

    await listComments("t1", "u1");
    expect(mockQuery.mock.calls[1][0]).toMatch(/ORDER BY created_at ASC/);
  });
});

describe("createComment", () => {
  it("rejects body < 1 char", async () => {
    await expect(createComment("t1", "u1", "")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects body > 15000 chars", async () => {
    await expect(createComment("t1", "u1", "x".repeat(15001))).rejects.toBeInstanceOf(AppError);
  });

  it("404s when task not accessible", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(createComment("t1", "u1", "hi")).rejects.toBeInstanceOf(AppError);
  });

  it("inserts and returns the comment", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [commentRow({ id: "c-uuid", user_id: "u1", body: "hi" })] });

    const c = await createComment("t1", "u1", "hi");
    expect(c.id).toBe("c-uuid");
    expect(c.body).toBe("hi");
  });
});

describe("updateComment", () => {
  it("404s when comment not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateComment("c1", "u1", "hi")).rejects.toBeInstanceOf(AppError);
  });

  it("forbids non-author edits", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "author" })] })
      .mockResolvedValueOnce({ rows: [taskRow()] });

    try {
      await updateComment("c1", "not-author", "edit");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(403);
    }
  });

  it("allows author to update body and sets updated_at", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "u1" })] })
      .mockResolvedValueOnce({ rows: [taskRow()] })
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "u1", body: "edit", updated_at: "2024-06-15T01:00:00Z" })] });

    const c = await updateComment("c1", "u1", "edit");
    expect(c.body).toBe("edit");
    expect(c.updatedAt).not.toBeNull();
  });
});

describe("deleteComment", () => {
  it("allows author to delete", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "u1" })] })
      .mockResolvedValueOnce({ rows: [taskRow("other-owner")] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await deleteComment("c1", "u1");
    expect(result).toEqual({ success: true });
  });

  it("allows task owner to delete someone else's comment", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "other-author" })] })
      .mockResolvedValueOnce({ rows: [taskRow("u1")] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await deleteComment("c1", "u1");
    expect(result).toEqual({ success: true });
  });

  it("forbids when neither author nor task owner", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [commentRow({ user_id: "author" })] })
      .mockResolvedValueOnce({ rows: [taskRow("other-owner")] });

    try {
      await deleteComment("c1", "u1");
      expect.fail("should throw");
    } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
    }
  });
});
