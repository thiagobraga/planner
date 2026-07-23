import { describe, it, vi, beforeEach } from "vitest";
import fc from "fast-check";
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

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() },
  redisPubClient: { publish: vi.fn() },
}));

vi.mock("uuid", () => ({ v4: () => "uuid-test" }));

import { updateTask, completeTask, reopenTask, deleteTask } from "../taskService.js";
import { listComments, createComment, updateComment, deleteComment } from "../commentService.js";
import { listRemindersForTask, createReminder } from "../reminderService.js";
import { listActivity } from "../activityService.js";
import { listCollaborators, removeCollaborator, assignTask } from "../collaborationService.js";
import { evaluateSavedFilter } from "../filterService.js";

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockClientQuery.mockResolvedValue({ rows: [] });
});

type NotAccessibleScenario = {
  name: string;
  run: (id: string, userId: string) => Promise<unknown>;
  prime: (id: string) => void;
};

const primeAccessFail = () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });
};

const primeCommentFoundButTaskInaccessible = (id: string) => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ id, task_id: "t1", user_id: "author", body: "x", created_at: "t", updated_at: null }] })
    .mockResolvedValueOnce({ rows: [] });
};

const scenarios: NotAccessibleScenario[] = [
  { name: "updateTask", run: (id, userId) => updateTask(id, userId, { title: "x" }), prime: primeAccessFail },
  { name: "completeTask", run: (id, userId) => completeTask(id, userId), prime: primeAccessFail },
  { name: "reopenTask", run: (id, userId) => reopenTask(id, userId), prime: primeAccessFail },
  { name: "deleteTask", run: (id, userId) => deleteTask(id, userId), prime: primeAccessFail },
  { name: "listComments", run: (id, userId) => listComments(id, userId), prime: primeAccessFail },
  { name: "createComment", run: (id, userId) => createComment(id, userId, "hello"), prime: primeAccessFail },
  { name: "updateComment", run: (id, userId) => updateComment(id, userId, "hello"), prime: primeCommentFoundButTaskInaccessible },
  { name: "deleteComment", run: (id, userId) => deleteComment(id, userId), prime: primeCommentFoundButTaskInaccessible },
  { name: "listRemindersForTask", run: (id, userId) => listRemindersForTask(id, userId), prime: primeAccessFail },
  {
    name: "createReminder",
    run: (id, userId) => createReminder(id, userId, new Date(Date.now() + 3600_000).toISOString()),
    prime: primeAccessFail,
  },
  { name: "listActivity (collection scoped)", run: (id, userId) => listActivity(userId, { collectionId: id }), prime: primeAccessFail },
  { name: "listCollaborators", run: (id, userId) => listCollaborators(id, userId), prime: primeAccessFail },
  { name: "removeCollaborator (non-owner)", run: (id, userId) => removeCollaborator(id, "some-collab", userId), prime: primeAccessFail },
  { name: "assignTask", run: (id, userId) => assignTask(id, "x", userId), prime: primeAccessFail },
  { name: "evaluateSavedFilter", run: (id, userId) => evaluateSavedFilter(id, userId, "2024-06-15"), prime: primeAccessFail },
];

const arbId = fc.uuid();
const arbUserId = fc.uuid();

describe("Property 26: Authorization enforcement (Requirements 26.3, 5.5)", () => {
  it("every service rejects when the access query returns no rows", async () => {
    for (const scenario of scenarios) {
      await fc.assert(
        fc.asyncProperty(arbId, arbUserId, async (id, userId) => {
          mockQuery.mockReset();
          mockClientQuery.mockReset();
          mockClientQuery.mockResolvedValue({ rows: [] });

          scenario.prime(id);

          try {
            await scenario.run(id, userId);
            return false;
          } catch (e) {
            if (!(e instanceof AppError)) return false;
            return e.statusCode === 403 || e.statusCode === 404;
          }
        }),
        { numRuns: 20 },
      );
    }
  });
});
