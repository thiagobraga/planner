import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSocket = {
  id: "socket-1",
  data: {} as { userId: string },
  handshake: { auth: {} },
  join: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
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

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn().mockReturnValue({ userId: "user-1" }),
  },
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

import { attachSyncServer, getIO, publishEvent } from "../syncService.js";
import { redisSubClient } from "../../db/redis.js";
import jwt from "jsonwebtoken";

describe("syncService: Socket.IO server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.data = {} as { userId: string };
    mockSocket.handshake.auth = {};
    mockSocket.join.mockClear();
    mockSocket.on.mockClear();
    mockIO.use.mockClear();
    mockIO.on.mockClear();
    mockIO.to.mockClear();
    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ userId: "user-1" });
  });

  describe("attachSyncServer", () => {
    it("creates an IO server instance", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      const io = await attachSyncServer(httpServer);
      expect(io).toBeDefined();
      expect(getIO()).toBe(io);
    });

    it("registers authentication middleware", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);
      expect(mockIO.use).toHaveBeenCalledTimes(1);
    });

    it("registers connection handler", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);
      expect(mockIO.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    it("subscribes to Redis sync channel", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);
      expect(redisSubClient.subscribe).toHaveBeenCalledWith("sync", expect.any(Function));
    });
  });

  describe("Socket authentication", () => {
    it("rejects connection without token", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const middleware = mockIO.use.mock.calls[0][0];
      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });

    it("rejects connection with invalid token", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("invalid");
      });

      const middleware = mockIO.use.mock.calls[0][0];
      const next = vi.fn();
      mockSocket.handshake.auth = { token: "invalid-token" };

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });

    it("rejects connection when userId is missing from token", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({});

      const middleware = mockIO.use.mock.calls[0][0];
      const next = vi.fn();
      mockSocket.handshake.auth = { token: "valid-token" };

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });

    it("accepts connection with valid token", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ userId: "user-1" });

      const middleware = mockIO.use.mock.calls[0][0];
      const next = vi.fn();
      mockSocket.handshake.auth = { token: "valid-token" };

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockSocket.data.userId).toBe("user-1");
    });
  });

  describe("Connection handling", () => {
    it("joins user room on connect", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const connectionHandler = mockIO.on.mock.calls[0][1];
      mockSocket.data.userId = "user-1";
      mockSocket.handshake.auth = { token: "valid-token" };
      await connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith("user:user-1");
    });

    it("joins collection rooms on connect", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const connectionHandler = mockIO.on.mock.calls[0][1];
      mockSocket.data.userId = "user-1";
      mockSocket.handshake.auth = { token: "valid-token" };
      await connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith("collection:collection-1");
    });

    it("handles subscribe:collection event", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const connectionHandler = mockIO.on.mock.calls[0][1];
      mockSocket.data.userId = "user-1";
      mockSocket.handshake.auth = { token: "valid-token" };
      await connectionHandler(mockSocket);

      const subscribeHandler = mockSocket.on.mock.calls.find(
        (call: unknown[]) => (call as string[])[0] === "subscribe:collection"
      )?.[1];

      expect(subscribeHandler).toBeDefined();
      subscribeHandler("collection-1");
      expect(mockSocket.join).toHaveBeenCalledWith("collection:collection-1");
    });
  });

  describe("Redis subscription fan-out", () => {
    it("emits sync event to user room", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const redisCallback = (global as Record<string, unknown>).__redisCallback as (msg: string) => void;
      const event = {
        id: "1",
        entityType: "task",
        eventType: "created",
        entityId: "task-1",
        userId: "user-1",
        emittedAt: new Date().toISOString(),
      };

      redisCallback(JSON.stringify(event));

      expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
    });

    it("emits sync event to collection room when collectionId is present", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const redisCallback = (global as Record<string, unknown>).__redisCallback as (msg: string) => void;
      const event = {
        id: "1",
        entityType: "task",
        eventType: "updated",
        entityId: "task-1",
        userId: "user-1",
        collectionId: "collection-1",
        emittedAt: new Date().toISOString(),
      };

      redisCallback(JSON.stringify(event));

      expect(mockIO.to).toHaveBeenCalledWith("collection:collection-1");
    });

    it("ignores malformed JSON from Redis", async () => {
      const httpServer = {} as Parameters<typeof attachSyncServer>[0];
      await attachSyncServer(httpServer);

      const redisCallback = (global as Record<string, unknown>).__redisCallback as (msg: string) => void;

      expect(() => {
        redisCallback("not valid json");
      }).not.toThrow();

      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });
});
