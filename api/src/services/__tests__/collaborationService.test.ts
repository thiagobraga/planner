import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/AppError.js";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

vi.mock("uuid", () => ({ v4: () => "uuid-1" }));

import {
  inviteToProject,
  acceptInvitation,
  listCollaborators,
  removeCollaborator,
  assignTask,
} from "../collaborationService.js";

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockClientQuery.mockResolvedValue({ rows: [] });
});

describe("inviteToProject", () => {
  it("rejects invalid email", async () => {
    await expect(inviteToProject("p1", "u1", "not-an-email")).rejects.toBeInstanceOf(AppError);
  });

  it("verifies owner before inserting invitation", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // not owner
    await expect(inviteToProject("p1", "u1", "a@b.com")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("creates invitation and returns plaintext token", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "p1" }] }) // ownership check
      .mockResolvedValueOnce({
        rows: [{ id: "i1", project_id: "p1", email: "a@b.com", token_hash: "hash", accepted_at: null, created_at: "t" }],
      });

    const result = await inviteToProject("p1", "u1", "a@b.com");
    expect(result.invitation.id).toBe("i1");
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(0);
  });
});

describe("acceptInvitation", () => {
  it("404s when token not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(acceptInvitation("tok", "u1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s when already accepted", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "i1", project_id: "p1", email: "a@b.com", token_hash: "hash", accepted_at: "2024-01-01", created_at: "t" }],
    });
    await expect(acceptInvitation("tok", "u1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("403s when email does not match", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: "i1", project_id: "p1", email: "intended@b.com", token_hash: "hash", accepted_at: null, created_at: "t" }],
      })
      .mockResolvedValueOnce({ rows: [{ email: "different@b.com" }] });
    await expect(acceptInvitation("tok", "u1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("inserts collaborator and marks invitation accepted", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: "i1", project_id: "p1", email: "a@b.com", token_hash: "hash", accepted_at: null, created_at: "t" }],
      })
      .mockResolvedValueOnce({ rows: [{ email: "a@b.com" }] });

    const result = await acceptInvitation("tok", "u1");
    expect(result.projectId).toBe("p1");
    expect(mockClientQuery).toHaveBeenCalled();
  });
});

describe("listCollaborators", () => {
  it("404s when not owner or collaborator", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(listCollaborators("p1", "u1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("removeCollaborator", () => {
  it("requires owner", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(removeCollaborator("p1", "c1", "u1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("unassigns tasks owned by the removed collaborator", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "p1" }] });
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "c1" }] }) // DELETE collaborator
      .mockResolvedValueOnce({ rows: [] }) // UPDATE tasks
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await removeCollaborator("p1", "c1", "u1");
    expect(result).toEqual({ success: true });

    const updateCall = mockClientQuery.mock.calls.find((c) => /UPDATE tasks/.test(c[0] as string));
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toMatch(/assignee_user_id = NULL/);
  });
});

describe("assignTask", () => {
  it("404s when task not accessible", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(assignTask("t1", "u2", "u1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects assignee not in project", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "t1", project_id: "p1", user_id: "u1" }] })
      .mockResolvedValueOnce({ rows: [] }); // assignee not owner/collab

    await expect(assignTask("t1", "outsider", "u1")).rejects.toBeInstanceOf(AppError);
  });

  it("allows unassign (assignee=null) without checking project membership", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "t1", project_id: "p1", user_id: "u1" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await assignTask("t1", null, "u1");
    expect(result).toEqual({ success: true });
  });

  it("assigns when target is project owner or collaborator", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "t1", project_id: "p1", user_id: "u1" }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await assignTask("t1", "collab", "u1");
    expect(result).toEqual({ success: true });
  });
});
