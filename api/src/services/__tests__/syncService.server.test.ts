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
  emit: vi.fn(),
  fetchSockets: vi.fn().mockResolvedValue([]),
};

vi.mock("http", () => ({
  Server: vi.fn(),
}));

vi.mock("socket.io", () => ({
  // Must be a function expression, not an arrow: attachSyncServer calls
  // `new IOServer(...)`, and arrow functions have no [[Construct]] slot.
  Server: vi.fn(function () {
    return mockIO;
  }),
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
      ((global as Record<string, unknown>).__redisCallbacks as Record<string, (msg: string) => void>)[channel] = callback;
      return Promise.resolve(undefined);
    }),
  },
}));

vi.mock("../../utils/buildInfo.js", () => ({
  LATEST_VERSION: "1.2.3",
}));

vi.mock("../sessionService.js", () => ({
  validateSession: vi.fn(),
  buildCookieName: vi.fn().mockReturnValue("planner_session"),
  needsTouch: vi.fn().mockReturnValue(false),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));

import { attachSyncServer, publishEvent, publishVersionAnnouncement, getIO } from "../syncService.js";
import { validateSession, needsTouch, touchSession } from "../sessionService.js";

(global as Record<string, unknown>).__redisCallbacks = {};

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

  it("subscribes to both the sync and version Redis channels", async () => {
    const httpServer = {} as import("http").Server;
    await attachSyncServer(httpServer);
    const { redisSubClient } = await import("../../db/redis.js");
    expect(redisSubClient.subscribe).toHaveBeenCalledWith("sync", expect.any(Function));
    expect(redisSubClient.subscribe).toHaveBeenCalledWith("version", expect.any(Function));
  });

  it("emits the current version to a freshly connected socket", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "user-1",
      sessionId: 1,
    });
    mockSocket.data = { userId: "user-1", sessionId: 1, rawToken: "valid-token" };
    mockSocket.emit.mockClear();

    const httpServer = {} as import("http").Server;
    await attachSyncServer(httpServer);
    const handler = captureConnectionHandler();
    await handler(mockSocket);

    expect(mockSocket.emit).toHaveBeenCalledWith("version", { version: "1.2.3" });
  });

  describe("publishVersionAnnouncement", () => {
    it("publishes the version to the version Redis channel", async () => {
      await publishVersionAnnouncement("1.2.3");
      const { redisPubClient } = await import("../../db/redis.js");
      expect(redisPubClient.publish).toHaveBeenCalledWith(
        "version",
        JSON.stringify({ version: "1.2.3" }),
      );
    });
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

  describe("redis subscription fanout", () => {
    async function triggerRedisMessage(raw: string, channel = "sync"): Promise<void> {
      const cbs = (global as Record<string, unknown>).__redisCallbacks as Record<string, (msg: string) => void>;
      await cbs[channel](raw);
    }

    beforeEach(async () => {
      vi.clearAllMocks();
      await attachSyncServer({} as import("http").Server);
    });

    it("emits to the user room and the collection room when the event has a collectionId", async () => {
      await triggerRedisMessage(
        JSON.stringify({ userId: "u1", collectionId: "c1", entityType: "task", eventType: "created" }),
      );
      expect(mockIO.to).toHaveBeenCalledWith("user:u1");
      expect(mockIO.to).toHaveBeenCalledWith("collection:c1");
    });

    it("emits only to the user room when the event has no collectionId", async () => {
      await triggerRedisMessage(JSON.stringify({ userId: "u1", entityType: "task", eventType: "created" }));
      expect(mockIO.to).toHaveBeenCalledWith("user:u1");
      expect(mockIO.to).not.toHaveBeenCalledWith(expect.stringContaining("collection:"));
    });

    it("drops malformed messages without emitting", async () => {
      await triggerRedisMessage("not json {");
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("broadcasts a version-channel message globally to every connected client", async () => {
      await triggerRedisMessage(JSON.stringify({ version: "1.2.4" }), "version");
      expect(mockIO.emit).toHaveBeenCalledWith("version", { version: "1.2.4" });
    });

    it("drops malformed version-channel messages without emitting", async () => {
      await triggerRedisMessage("not json {", "version");
      expect(mockIO.emit).not.toHaveBeenCalled();
    });
  });

  describe("getIO", () => {
    it("returns the attached Socket.IO instance", async () => {
      await attachSyncServer({} as import("http").Server);
      expect(getIO()).toBe(mockIO);
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

    it("lets task:update through when the session is valid and the collection is owned", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
      });

      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:update",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskUpdateHandler({ collectionId: "collection-1" });
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it("disconnects on task:update when the collection is not a member of", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
      });

      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:update",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskUpdateHandler({ collectionId: "foreign-collection" });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("disconnects on task:delete when the collection is not a member of", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
      });

      const taskDeleteHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "task:delete",
      )?.[1] as (event: { collectionId?: string }) => void;

      await taskDeleteHandler({ collectionId: "foreign-collection" });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("validates the session on comment:create", async () => {
      const commentHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "comment:create",
      )?.[1] as () => Promise<void>;

      await commentHandler();
      expect(validateSession).toHaveBeenCalled();
    });

    it("joins the collection room on subscribe:collection when the user is a member", async () => {
      mockSocket.join.mockClear();

      const subscribeHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "subscribe:collection",
      )?.[1] as (collectionId: string) => void;

      subscribeHandler("collection-1");
      expect(mockSocket.join).toHaveBeenCalledWith("collection:collection-1");
    });

    it("ignores subscribe:collection for a collection the user is not a member of", async () => {
      mockSocket.join.mockClear();

      const subscribeHandler = mockSocket.on.mock.calls.find(
        (c: unknown[]) => c[0] === "subscribe:collection",
      )?.[1] as (collectionId: string) => void;

      subscribeHandler("foreign-collection");
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  // The sweep that drops sockets whose session died is also the only thing
  // that runs on a tab nobody is touching, so it doubles as that tab's
  // keep-alive. Without it an idle-but-open tab expired out from under itself:
  // the sweep would notice, close the socket, and the reconnect would come back
  // UNAUTHORIZED and log the user out with no action of theirs involved.
  describe("session revalidation sweep", () => {
    const REVALIDATION_INTERVAL_MS = 60_000;

    async function runOneSweep(): Promise<void> {
      vi.useFakeTimers();
      try {
        await attachSyncServer({} as import("http").Server);
        await vi.advanceTimersByTimeAsync(REVALIDATION_INTERVAL_MS);
      } finally {
        vi.useRealTimers();
      }
    }

    beforeEach(() => {
      mockIO.fetchSockets.mockResolvedValue([
        { data: { userId: "user-1", sessionId: 1, rawToken: "live-token" }, disconnect: vi.fn() },
      ]);
    });

    it("keeps a connected tab's session alive when its idle window has gone stale", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
        lastSeenAt: new Date(0),
      });
      (needsTouch as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await runOneSweep();

      expect(touchSession).toHaveBeenCalledWith(1);
    });

    it("does not write on every sweep, only once the touch interval has passed", async () => {
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        sessionId: 1,
        lastSeenAt: new Date(),
      });
      (needsTouch as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await runOneSweep();

      expect(touchSession).not.toHaveBeenCalled();
    });

    it("drops the socket and does not touch when the session is already gone", async () => {
      const socket = { data: { userId: "user-1", sessionId: 1, rawToken: "dead-token" }, disconnect: vi.fn() };
      mockIO.fetchSockets.mockResolvedValue([socket]);
      (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (needsTouch as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await runOneSweep();

      expect(socket.disconnect).toHaveBeenCalled();
      expect(touchSession).not.toHaveBeenCalled();
    });

    it("drops sockets without a rawToken without touching them", async () => {
      const socket = { data: { userId: "user-1", sessionId: 1 }, disconnect: vi.fn() };
      mockIO.fetchSockets.mockResolvedValue([socket]);

      await runOneSweep();

      expect(socket.disconnect).toHaveBeenCalled();
      expect(touchSession).not.toHaveBeenCalled();
    });
  });
});
