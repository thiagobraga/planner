import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

const mockUUID = "00000000-0000-0000-0000-000000000001";
vi.mock("node:crypto", () => ({
  default: { randomUUID: () => mockUUID },
}));

import { securityLog } from "../securityLogger.js";

function mockReq(overrides?: Partial<Request>): Request {
  return {
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    res: { getHeader: () => "req-123" },
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("securityLog", () => {
  const cases: Array<{ name: string; fn: () => void; expectedType: string }> = [
    {
      name: "authLoginSuccess",
      fn: () => securityLog.authLoginSuccess(mockReq(), "u1"),
      expectedType: "auth:login:success",
    },
    {
      name: "authLoginFailure",
      fn: () => securityLog.authLoginFailure(mockReq(), "invalid-credentials"),
      expectedType: "auth:login:failure",
    },
    {
      name: "authLogout",
      fn: () => securityLog.authLogout(mockReq(), "u1", 42),
      expectedType: "auth:logout",
    },
    {
      name: "authRegisterSuccess",
      fn: () => securityLog.authRegisterSuccess(mockReq(), "u1"),
      expectedType: "auth:register:success",
    },
    {
      name: "authRegisterFailure",
      fn: () => securityLog.authRegisterFailure(mockReq(), "email-exists"),
      expectedType: "auth:register:failure",
    },
    {
      name: "rateLimitActivated",
      fn: () => securityLog.rateLimitActivated(mockReq(), "login:u1", 900000),
      expectedType: "rate-limit:activated",
    },
    {
      name: "rateLimitExceeded",
      fn: () => securityLog.rateLimitExceeded(mockReq(), "login:u1", 10),
      expectedType: "rate-limit:exceeded",
    },
    {
      name: "sessionRevoked",
      fn: () => securityLog.sessionRevoked("u1", "manual"),
      expectedType: "auth:session:revoked",
    },
    {
      name: "sessionExpired",
      fn: () => securityLog.sessionExpired("u1", 1),
      expectedType: "auth:session:expired",
    },
    {
      name: "passwordChanged",
      fn: () => securityLog.passwordChanged("u1"),
      expectedType: "auth:password:change",
    },
    {
      name: "provisioningUserCreated",
      fn: () => securityLog.provisioningUserCreated("u1", "test@example.com"),
      expectedType: "provisioning:user:created",
    },
    {
      name: "migrationStarted",
      fn: () => securityLog.migrationStarted(),
      expectedType: "migration:started",
    },
    {
      name: "migrationCompleted",
      fn: () => securityLog.migrationCompleted(3),
      expectedType: "migration:completed",
    },
    {
      name: "migrationFailed",
      fn: () => securityLog.migrationFailed("connection lost"),
      expectedType: "migration:failed",
    },
  ];

  for (const { name, fn, expectedType } of cases) {
    it(`logs ${name} with correct type`, () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      fn();
      expect(spy).toHaveBeenCalledTimes(1);
      const event = JSON.parse(spy.mock.calls[0][0]);
      expect(event.id).toBe(mockUUID);
      expect(event.type).toBe(expectedType);
      expect(event.timestamp).toBeDefined();
    });
  }

  it("includes request context when req is provided", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    securityLog.authLoginSuccess(mockReq(), "u1");
    const event = JSON.parse(spy.mock.calls[0][0]);
    expect(event.requestId).toBe("req-123");
    expect(event.ip).toBe("127.0.0.1");
    expect(event.userId).toBe("u1");
  });

  it("omits request context when req is absent", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    securityLog.passwordChanged("u1");
    const event = JSON.parse(spy.mock.calls[0][0]);
    expect(event.requestId).toBeUndefined();
    expect(event.ip).toBeUndefined();
  });

  it("backup methods log correct events", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    securityLog.backupCreated("/backups/db.sql", 1024);
    securityLog.backupRestored("/backups/db.sql");
    securityLog.backupRestoreVerified({ users: 1, tasks: 10 });
    securityLog.backupFailed("disk full");

    expect(JSON.parse(spy.mock.calls[0][0]).type).toBe("backup:created");
    expect(JSON.parse(spy.mock.calls[1][0]).type).toBe("backup:restored");
    expect(JSON.parse(spy.mock.calls[2][0]).type).toBe("backup:restore:verified");
    expect(JSON.parse(spy.mock.calls[3][0]).type).toBe("backup:failed");
  });

  it("authLoginFailure includes reason in metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    securityLog.authLoginFailure(mockReq(), "rate-limited");
    const event = JSON.parse(spy.mock.calls[0][0]);
    expect(event.metadata.reason).toBe("rate-limited");
  });
});
