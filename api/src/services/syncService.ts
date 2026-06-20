import type { Server as HTTPServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { redisPubClient, redisSubClient } from "../db/redis.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SYNC_CHANNEL = "sync";

export type SyncEntityType = "task" | "project" | "section" | "label" | "comment" | "reminder";
export type SyncEventType = "created" | "updated" | "deleted" | "completed" | "uncompleted";

export interface SyncEvent {
  id: string;
  entityType: SyncEntityType;
  eventType: SyncEventType;
  entityId: string;
  userId: string;
  projectId?: string | null;
  payload?: unknown;
  emittedAt: string;
}

interface JwtPayload {
  userId: string;
  sessionId?: string;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function projectRoom(projectId: string): string {
  return `project:${projectId}`;
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

// Used by service layer to emit changes without depending on the IO server directly.
export function buildEvent(input: Omit<SyncEvent, "id" | "emittedAt"> & { id?: string }): SyncEvent {
  return {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    emittedAt: new Date().toISOString(),
    ...input,
  };
}

async function loadUserProjectIds(userId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT id AS project_id FROM projects WHERE user_id = $1
     UNION
     SELECT project_id FROM collaborators WHERE user_id = $1`,
    [userId],
  );
  return result.rows.map((r: { project_id: string }) => r.project_id);
}

export async function attachSyncServer(httpServer: HTTPServer): Promise<IOServer> {
  const io = new IOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    if (!payload.userId) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    (socket.data as { userId: string }).userId = payload.userId;
    next();
  });

  console.log("[sync] Socket.IO attached to HTTP server");

  io.on("connection", async (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    console.log(`[sync] socket connected user=${userId} id=${socket.id}`);
    socket.join(userRoom(userId));

    const projectIds = await loadUserProjectIds(userId);
    for (const pid of projectIds) {
      socket.join(projectRoom(pid));
    }

    socket.on("subscribe:project", (projectId: string) => {
      if (typeof projectId === "string" && projectIds.includes(projectId)) {
        socket.join(projectRoom(projectId));
      }
    });
  });

  await redisSubClient.subscribe(SYNC_CHANNEL, (raw: string) => {
    let event: SyncEvent;
    try {
      event = JSON.parse(raw) as SyncEvent;
    } catch {
      return;
    }

    // Fan out: all of this user's sessions
    io.to(userRoom(event.userId)).emit("sync", event);

    // If the change is project-scoped, also to all collaborators in the project room
    if (event.projectId) {
      io.to(projectRoom(event.projectId)).emit("sync", event);
    }
  });

  console.log("[sync] Redis subscription ready");

  ioInstance = io;
  return io;
}
