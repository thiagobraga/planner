import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSocket = {
  id: "socket-1",
  data: {} as { userId: string; sessionId: number; rawToken?: string },
  handshake: { auth: {}, headers: {} } as { auth: Record<string, unknown>; headers: Record<string, string> },
  join: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

const mockIO = {
  use: vi.fn(),
  on: vi.fn(),
  to: vi.fn().mockReturnValue({ emit: vi.fn() }),
};

vi.mock("http", () => ({
  Server: vi.fn(),
}));

vi.mock("socket.io", () => ({
  Server: vi.fn().mockImplementation(() => mockIO),
}));

vi.mock("../../db/pool.js", () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [{ collection_id: "collection-1" }] }),
  },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: {
    subscribe: vi.fn().mockImplementation((channel: string, callback: (msg: string) => void) => {
      (global as Record<string, unknown>).__redisCallback = callback;
      return Promise.resolve(undefined);
    }),
  },
}));

vi.mock("../sessionService.js", () => ({
  validateSession: vi.fn(),
  buildCookieName: vi.fn().mockReturnValue("planner_session"),
}));

import { attachSyncServer, getIO, publishEvent } from "../syncService.js";
import { redisSubClient } from "../../db/redis.js";
import { validateSession } from "../sessionService.js";

function captureConnectionHandler(): (...args: unknown[]) => void {
  return mockIO.on.mock.calls.find((c: unknown[]) => c[0] === "connection")?.[1] as (...args: unknown[]) => void;
}

describe("syncService: Socket.IO server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.data = {} as { userId: string; sessionId: number; rawToken?: string };
    mockSocket.handshake.auth = {};
    mockSocket.handshake.headers = {};
    mockSocket.join.mockClear();
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();
    mockIO.use.mockClear();
    mockIO.on.mockClear();
  });

  it("attaches the sync server and registers middleware", async () => {
    const httpServer = {} as import("http").Server;
    const io = await attachSyncServer(httpServer);
    expect(io).toBe(mockIO);
    expect(mockIO.use).toHaveBeenCalled();
    expect(mockIO.on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  describe("socket auth middleware", () => {
    it("passes when cookie contains a valid session", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
      });

      const httpServer = {} as import("http").Server;
      await attachSyncServer(httpServer);
      const middleware = mockIO.use.mock.calls[0][0];

      mockSocket.handshake.headers = {
        cookie: "planner_session=valid-token",
      };

      const next = vi.fn();
      await middleware(mockSocket, next);
      expect(next).toHaveBeenCalledWith();
      expect(mockSocket.data.userId).toBe("user-1");
      expect(mockSocket.data.sessionId).toBe(1);
      expect(mockSocket.data.rawToken).toBe("valid-token");
    });

    it("blocks when no cookie is present", async () => {
      const httpServer = {} as import("http").Server;
      await attachSyncServer(httpServer);
      const middleware = mockIO.use.mock.calls[0][0];

      mockSocket.handshake.headers = {};

      const next = vi.fn();
      await middleware(mockSocket, next);
      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });

    it("blocks when session is invalid", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const httpServer = {} as import("http").Server;
      await attachSyncServer(httpServer);
      const middleware = mockIO.use.mock.calls[0][0];

      mockSocket.handshake.headers = {
        cookie: "planner_session=invalid-token",
      };

      const next = vi.fn();
      await middleware(mockSocket, next);
      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });
  });

  describe("publishEvent", () => {
    it("publishes a sync event to the Redis channel", async () => {
      const event = {
        id: "evt-1",
        entityType: "task" as const,
        eventType: "created" as const,
        entityId: "task-1",
        userId: "user-1",
        emittedAt: new Date().toISOString(),
      };

      await publishEvent(event);
      const { redisPubClient } = await import("../../db/redis.js");
      expect(redisPubClient.publish).toHaveBeenCalledWith(
        "sync",
        JSON.stringify(event),
      );
    });
  });

  describe("client event session validation", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockSocket.data = {
        userId: "user-1",
        sessionId: 1,
        rawToken: "valid-token",
      } as { userId: string; sessionId: number; rawToken?: string };

      mockSocket.disconnect.mockClear();
      mockSocket.on.mockClear();
      mockSocket.on.mockClear();

      const httpServer = {} as import("http").Server;
      await attachSyncServer(httpServer);
      const handler = captureConnectionHandler();
      await handler(mockSocket);
    });

    it("rejects task:update when session is invalid", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:update",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskUpdateHandler({ collectionId: "collection-1" });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("rejects task:delete when session is invalid", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const taskDeleteHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:delete",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskDeleteHandler({ collectionId: "collection-1" });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("disconnects when rawToken is missing from socket data", async () => {
      mockSocket.data = { userId: "user-1", sessionId: 1 };

      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:update",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskUpdateHandler({ collectionId: "collection-1" });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
});
