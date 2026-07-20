import type { Server as HTTPServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import pool from "../db/pool.js";
import { redisPubClient, redisSubClient } from "../db/redis.js";
import { CORS_ORIGIN } from "../config.js";
import { validateSession, buildCookieName } from "./sessionService.js";

const SYNC_CHANNEL = "sync";
const SESSION_REVALIDATION_INTERVAL_MS = 60_000;

interface SocketData {
  userId: string;
  sessionId: number;
  rawToken?: string;
}

export type SyncEntityType = "task" | "collection" | "section" | "label" | "comment" | "reminder" | "preferences" | "habit" | "habit_completion" | "habit_group";
export type SyncEventType = "created" | "updated" | "deleted" | "completed" | "uncompleted";

export interface SyncEvent {
  id: string;
  entityType: SyncEntityType;
  eventType: SyncEventType;
  entityId: string;
  userId: string;
  collectionId?: string | null;
  payload?: unknown;
  emittedAt: string;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function collectionRoom(collectionId: string): string {
  return `collection:${collectionId}`;
}

async function isSessionValid(socket: Socket): Promise<boolean> {
  const rawToken = (socket.data as SocketData).rawToken;
  if (!rawToken) {
    socket.disconnect();
    return false;
  }
  const session = await validateSession(rawToken);
  if (!session) {
    socket.disconnect();
    return false;
  }
  return true;
}

function startSessionRevalidation(io: IOServer): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        const rawToken = (socket.data as SocketData).rawToken;
        if (!rawToken) {
          socket.disconnect();
          continue;
        }
        const session = await validateSession(rawToken);
        if (!session) {
          socket.disconnect();
        }
      }
    } catch {
      // swallow — don't crash the interval on transient failures
    }
  }, SESSION_REVALIDATION_INTERVAL_MS);
}

let ioInstance: IOServer | null = null;

export function getIO(): IOServer | null {
  return ioInstance;
}

export async function publishEvent(event: SyncEvent): Promise<void> {
  try {
    await redisPubClient.publish(SYNC_CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.error("[sync] publishEvent failed:", err);
    throw err;
  }
}

export function buildEvent(input: Omit<SyncEvent, "id" | "emittedAt"> & { id?: string }): SyncEvent {
  return {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    emittedAt: new Date().toISOString(),
    ...input,
  };
}

async function loadUserCollectionIds(userId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT id AS collection_id FROM collections WHERE user_id = $1
     UNION
     SELECT collection_id FROM collaborators WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r: { collection_id: string }) => r.collection_id);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((pair) => {
      const [key, ...rest] = pair.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
}

function extractSessionFromSocket(socket: Socket): string | null {
  const cookieHeader = (socket.handshake.headers as Record<string, string | string[] | undefined> | undefined)?.cookie as string | undefined;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const cookieName = buildCookieName();
    const token = cookies[cookieName];
    if (token) return token;
  }
  return null;
}

export async function attachSyncServer(httpServer: HTTPServer): Promise<IOServer> {
  const io = new IOServer(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    const rawToken = extractSessionFromSocket(socket);
    if (!rawToken) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    const session = await validateSession(rawToken);
    if (!session) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    const data = socket.data as SocketData;
    data.userId = session.userId;
    data.sessionId = session.sessionId;
    data.rawToken = rawToken;
    next();
  });

  console.log("[sync] Socket.IO attached to HTTP server");

  io.on("connection", async (socket: Socket) => {
    const data = socket.data as SocketData;
    const userId = data.userId;
    console.log(`[sync] socket connected user=${userId} id=${socket.id}`);
    socket.join(userRoom(userId));

    const collectionIds = await loadUserCollectionIds(userId);
    for (const pid of collectionIds) {
      socket.join(collectionRoom(pid));
    }

    socket.on("subscribe:collection", (collectionId: string) => {
      if (typeof collectionId === "string" && collectionIds.includes(collectionId)) {
        socket.join(collectionRoom(collectionId));
      }
    });

    socket.on("task:update", async (event: { collectionId?: string }) => {
      if (!(await isSessionValid(socket))) return;
      if (event?.collectionId && !collectionIds.includes(event.collectionId)) {
        socket.disconnect();
      }
    });

    socket.on("task:delete", async (event: { collectionId?: string }) => {
      if (!(await isSessionValid(socket))) return;
      if (event?.collectionId && !collectionIds.includes(event.collectionId)) {
        socket.disconnect();
      }
    });

    socket.on("comment:create", async () => {
      await isSessionValid(socket);
    });
  });

  await redisSubClient.subscribe(SYNC_CHANNEL, (raw: string) => {
    let event: SyncEvent;
    try {
      event = JSON.parse(raw) as SyncEvent;
    } catch {
      return;
    }

    io.to(userRoom(event.userId)).emit("sync", event);

    if (event.collectionId) {
      io.to(collectionRoom(event.collectionId)).emit("sync", event);
    }
  });

  console.log("[sync] Redis subscription ready");

  startSessionRevalidation(io);

  ioInstance = io;
  return io;
}
