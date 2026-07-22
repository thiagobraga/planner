import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";

const OLD_ENV = { ...process.env };

const mockFsStore = vi.hoisted(() => ({ contents: {} as Record<string, string> }));

vi.mock("node:fs", () => ({
  readFileSync: (path: string) => {
    const content = mockFsStore.contents[path];
    if (content !== undefined) return content;
    const err = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  },
}));

beforeEach(() => {
  vi.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.NODE_ENV;
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_FILE;
  delete process.env.REDIS_URL;
  delete process.env.REDIS_URL_FILE;
  delete process.env.CSRF_SECRET;
  delete process.env.CSRF_SECRET_FILE;
  delete process.env.CORS_ORIGIN;
  delete process.env.CORS_ORIGIN_FILE;
  delete process.env.SESSION_IDLE_TTL_MINUTES;
  delete process.env.SESSION_ABSOLUTE_TTL_HOURS;
  delete process.env.PORT;
});

describe("config", () => {
  describe("NODE_ENV validation", () => {
    it("rejects invalid NODE_ENV", async () => {
      process.env.NODE_ENV = "staging";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      await expect(() => import("./config.js")).rejects.toThrow(
        /NODE_ENV must be one of/,
      );
    });

    it("accepts production NODE_ENV with valid config", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      const cfg = await import("./config.js");
      expect(cfg.NODE_ENV).toBe("production");
      expect(cfg.IS_PRODUCTION).toBe(true);
    });

    it("accepts test NODE_ENV", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.IS_PRODUCTION).toBe(false);
    });

    it("defaults to development when NODE_ENV is unset", async () => {
      delete process.env.NODE_ENV;
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.NODE_ENV).toBe("development");
    });
  });

  describe("DATABASE_URL", () => {
    it("requires DATABASE_URL in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      await expect(() => import("./config.js")).rejects.toThrow(
        /Missing required/,
      );
    });

    it("rejects non-postgres DATABASE_URL in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "mysql://localhost:3306/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      await expect(() => import("./config.js")).rejects.toThrow(
        /must start with postgres/,
      );
    });

    it("reads from DATABASE_URL_FILE", async () => {
      const url = "postgres://user:pass@host:5432/db";
      mockFsStore.contents = { "/run/secrets/database_url": `${url}\n` };
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL_FILE = "/run/secrets/database_url";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      mockFsStore.contents = {};
      expect(cfg.DATABASE_URL).toBe(url);
    });
  });

  describe("CSRF_SECRET", () => {
    it("rejects short CSRF_SECRET in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "short";
      process.env.CORS_ORIGIN = "https://planner.example.com";
      await expect(() => import("./config.js")).rejects.toThrow(
        /CSRF_SECRET must be at least 32 characters/,
      );
    });
  });

  describe("CORS_ORIGIN", () => {
    it("rejects invalid URL in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "not-a-url";
      await expect(() => import("./config.js")).rejects.toThrow(
        /CORS_ORIGIN is not a valid URL/,
      );
    });
  });

  describe("session TTLs", () => {
    it("defaults to 30-minute idle and 12-hour absolute", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.SESSION_IDLE_TTL_MINUTES).toBe(30);
      expect(cfg.SESSION_ABSOLUTE_TTL_HOURS).toBe(12);
    });

    it("reads session TTLs from environment", async () => {
      process.env.NODE_ENV = "test";
      process.env.SESSION_IDLE_TTL_MINUTES = "15";
      process.env.SESSION_ABSOLUTE_TTL_HOURS = "8";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.SESSION_IDLE_TTL_MINUTES).toBe(15);
      expect(cfg.SESSION_ABSOLUTE_TTL_HOURS).toBe(8);
    });

    it("rejects non-positive integer session TTLs", async () => {
      process.env.NODE_ENV = "test";
      process.env.SESSION_IDLE_TTL_MINUTES = "0";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      await expect(() => import("./config.js")).rejects.toThrow(
        /SESSION_IDLE_TTL_MINUTES must be a positive integer/,
      );
    });
  });

  describe("PORT", () => {
    it("defaults to 4000", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.PORT).toBe("4000");
    });

    it("reads PORT from environment", async () => {
      process.env.NODE_ENV = "test";
      process.env.PORT = "8080";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.PORT).toBe("8080");
    });
  });

  describe("DISABLE_RATE_LIMITS_IN_DEV", () => {
    it("is true in development", async () => {
      process.env.NODE_ENV = "development";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.DISABLE_RATE_LIMITS_IN_DEV).toBe(true);
    });

    it("is false in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      const cfg = await import("./config.js");
      expect(cfg.DISABLE_RATE_LIMITS_IN_DEV).toBe(false);
    });

    it("is true when NODE_ENV is unset", async () => {
      delete process.env.NODE_ENV;
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.DISABLE_RATE_LIMITS_IN_DEV).toBe(true);
    });
  });

  describe("REDIS_URL", () => {
    it("defaults to redis://localhost:6379", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.REDIS_URL).toBe("redis://localhost:6379");
    });

    it("reads from REDIS_URL_FILE", async () => {
      const url = "redis://custom:6379";
      mockFsStore.contents = { "/run/secrets/redis_url": `${url}\n` };
      process.env.NODE_ENV = "test";
      process.env.REDIS_URL_FILE = "/run/secrets/redis_url";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      mockFsStore.contents = {};
      expect(cfg.REDIS_URL).toBe(url);
    });

    it("rejects invalid REDIS_URL scheme in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "mysql://localhost:3306";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      await expect(() => import("./config.js")).rejects.toThrow(
        /must start with redis/,
      );
    });

    it("rejects placeholder REDIS_URL in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://change-me:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      await expect(() => import("./config.js")).rejects.toThrow(/placeholder/i);
    });
  });

  describe("CORS_ORIGIN", () => {
    it("defaults to http://localhost:5173", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CSRF_SECRET = "a".repeat(32);
      const cfg = await import("./config.js");
      expect(cfg.CORS_ORIGIN).toBe("http://localhost:5173");
    });

    it("rejects placeholder CORS_ORIGIN in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://change-me";
      await expect(() => import("./config.js")).rejects.toThrow(/placeholder/i);
    });
  });

  describe("CSRF_SECRET", () => {
    it("defaults to 32-char string in test", async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.CSRF_SECRET).toBe("a".repeat(32));
    });

    it("rejects placeholder CSRF_SECRET in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "https://planner.example.com";
      const cfg = await import("./config.js");
      expect(cfg.CSRF_SECRET).toBe("a".repeat(32));
    });
  });

  describe("readSecret error paths", () => {
    it("throws when _FILE path does not exist", async () => {
      process.env.NODE_ENV = "test";
      process.env.CSRF_SECRET_FILE = "/nonexistent/path";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CORS_ORIGIN = "http://localhost:3000";
      await expect(() => import("./config.js")).rejects.toThrow(/Cannot read secret file/);
    });

    it("reads CSRF_SECRET from _FILE", async () => {
      mockFsStore.contents = { "/run/secrets/csrf": `${"b".repeat(32)}\n` };
      process.env.NODE_ENV = "test";
      process.env.CSRF_SECRET_FILE = "/run/secrets/csrf";
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      mockFsStore.contents = {};
      expect(cfg.CSRF_SECRET).toBe("b".repeat(32));
    });
  });

  describe("DATABASE_URL defaults", () => {
    it("defaults to test fallback URL in test env", async () => {
      process.env.NODE_ENV = "test";
      process.env.CSRF_SECRET = "a".repeat(32);
      process.env.CORS_ORIGIN = "http://localhost:3000";
      const cfg = await import("./config.js");
      expect(cfg.DATABASE_URL).toBe("postgres://planner:planner@localhost:5432/planner_test");
    });
  });
});
