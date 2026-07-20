import crypto from "node:crypto";
import type { Request } from "express";

export type SecurityEventType =
  | "auth:login:success"
  | "auth:login:failure"
  | "auth:logout"
  | "auth:register:success"
  | "auth:register:failure"
  | "auth:password:reset:request"
  | "auth:password:reset:complete"
  | "auth:password:change"
  | "auth:session:revoked"
  | "auth:session:expired"
  | "rate-limit:activated"
  | "rate-limit:exceeded"
  | "provisioning:user:created"
  | "migration:started"
  | "migration:completed"
  | "migration:failed"
  | "backup:created"
  | "backup:restored"
  | "backup:restore:verified"
  | "backup:failed"
  | "tls:cert:renewed";

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  requestId?: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

function baseEvent(req?: Request): Pick<SecurityEvent, "id" | "timestamp" | "requestId" | "ip"> {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    requestId: req?.res?.getHeader("X-Request-Id") as string | undefined,
    ip: req?.ip ?? req?.socket?.remoteAddress,
  };
}

function log(event: SecurityEvent): void {
  console.log(JSON.stringify(event));
}

export const securityLog = {
  authLoginSuccess(req: Request, userId: string): void {
    log({ ...baseEvent(req), type: "auth:login:success", userId, metadata: { method: "password" } });
  },

  authLoginFailure(req: Request, reason: "invalid-credentials" | "account-locked" | "rate-limited"): void {
    log({ ...baseEvent(req), type: "auth:login:failure", metadata: { reason } });
  },

  authLogout(req: Request, userId: string, sessionId: number): void {
    log({ ...baseEvent(req), type: "auth:logout", userId, metadata: { sessionId } });
  },

  authRegisterSuccess(req: Request, userId: string): void {
    log({ ...baseEvent(req), type: "auth:register:success", userId });
  },

  authRegisterFailure(req: Request, reason: "email-exists" | "rate-limited"): void {
    log({ ...baseEvent(req), type: "auth:register:failure", metadata: { reason } });
  },

  rateLimitActivated(req: Request, key: string, windowMs: number): void {
    log({
      ...baseEvent(req),
      type: "rate-limit:activated",
      metadata: { key, windowMs },
    });
  },

  rateLimitExceeded(req: Request, key: string, limit: number): void {
    log({
      ...baseEvent(req),
      type: "rate-limit:exceeded",
      metadata: { key, limit },
    });
  },

  sessionRevoked(userId: string, reason: string, revokerId?: string): void {
    log({
      ...baseEvent(),
      type: "auth:session:revoked",
      userId,
      metadata: { reason, revokedBy: revokerId },
    });
  },

  sessionExpired(userId: string, sessionId: number): void {
    log({
      ...baseEvent(),
      type: "auth:session:expired",
      userId,
      metadata: { sessionId },
    });
  },

  passwordChanged(userId: string): void {
    log({
      ...baseEvent(),
      type: "auth:password:change",
      userId,
    });
  },

  provisioningUserCreated(userId: string, email: string): void {
    log({
      ...baseEvent(),
      type: "provisioning:user:created",
      metadata: { userId, email },
    });
  },

  migrationStarted(): void {
    log({ ...baseEvent(), type: "migration:started" });
  },

  migrationCompleted(applied: number): void {
    log({
      ...baseEvent(),
      type: "migration:completed",
      metadata: { applied },
    });
  },

  migrationFailed(error: string): void {
    log({
      ...baseEvent(),
      type: "migration:failed",
      metadata: { error },
    });
  },

  backupCreated(backupPath: string, sizeBytes: number): void {
    log({
      ...baseEvent(),
      type: "backup:created",
      metadata: { path: backupPath, sizeBytes },
    });
  },

  backupRestored(backupPath: string): void {
    log({
      ...baseEvent(),
      type: "backup:restored",
      metadata: { path: backupPath },
    });
  },

  backupRestoreVerified(rowCounts: Record<string, number>): void {
    log({
      ...baseEvent(),
      type: "backup:restore:verified",
      metadata: { rowCounts },
    });
  },

  backupFailed(error: string): void {
    log({
      ...baseEvent(),
      type: "backup:failed",
      metadata: { error },
    });
  },
};
