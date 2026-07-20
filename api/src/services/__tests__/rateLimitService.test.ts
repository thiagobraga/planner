import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockDel = vi.fn();

vi.mock("../../db/redis.js", () => ({
  redisClient: {
    get: (...args: unknown[]) => mockGet(...args),
    incr: (...args: unknown[]) => mockIncr(...args),
    expire: (...args: unknown[]) => mockExpire(...args),
    del: (...args: unknown[]) => mockDel(...args),
    isReady: true,
  },
}));

import {
  checkLoginRate,
  incrementLoginAttempts,
  clearLoginRate,
  getProgressiveDelay,
  checkRegistrationRate,
  checkPasswordResetRate,
  resetMemFallbackFlag,
} from "../rateLimitService.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetMemFallbackFlag();
  mockGet.mockResolvedValue(null);
  mockIncr.mockResolvedValue(1);
  mockExpire.mockResolvedValue(true);
  mockDel.mockResolvedValue(1);
});

describe("checkLoginRate", () => {
  it("allows when no prior attempts exist", async () => {
    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it("denies when account attempts exceed max", async () => {
    mockGet.mockResolvedValue("15");

    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("denies when IP attempts exceed max", async () => {
    mockGet
      .mockResolvedValueOnce("3")
      .mockResolvedValueOnce("25");

    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(false);
  });

  it("uses different Redis keys for different emails", async () => {
    await checkLoginRate("user1@example.com", "1.2.3.4");
    await checkLoginRate("user2@example.com", "1.2.3.4");

    const keysUsed = mockGet.mock.calls.map((c: string[]) => c[0]);
    const accountKeys = keysUsed.filter((k: string) => k.startsWith("rl:acct:"));
    expect(new Set(accountKeys).size).toBe(2);
  });

  it("uses hashed email in Redis key, never raw email", async () => {
    await checkLoginRate("user@example.com", "1.2.3.4");

    const keysUsed = mockGet.mock.calls.map((c: string[]) => c[0]);
    const accountKeys = keysUsed.filter((k: string) => k.startsWith("rl:acct:"));
    expect(accountKeys.length).toBe(1);

    const key = accountKeys[0];
    expect(key).not.toContain("user@example.com");
    expect(key).toMatch(/^rl:acct:[a-f0-9]{64}$/);
  });

  it("falls back to in-memory store when Redis is down", async () => {
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(true);
  });
});

describe("incrementLoginAttempts", () => {
  it("increments both account and IP keys", async () => {
    mockIncr.mockResolvedValue(1);

    await incrementLoginAttempts("user@example.com", "1.2.3.4");

    const incrCalls = mockIncr.mock.calls.map((c: string[]) => c[0]);
    expect(incrCalls.some((k: string) => k.startsWith("rl:acct:"))).toBe(true);
    expect(incrCalls.some((k: string) => k.startsWith("rl:login:ip:"))).toBe(true);

    expect(mockExpire).toHaveBeenCalledTimes(2);
  });
});

describe("clearLoginRate", () => {
  it("deletes both account and IP keys", async () => {
    await clearLoginRate("user@example.com", "1.2.3.4");

    const delCalls = mockDel.mock.calls.map((c: string[]) => c[0]);
    expect(delCalls.some((k: string) => k.startsWith("rl:acct:"))).toBe(true);
    expect(delCalls.some((k: string) => k.startsWith("rl:login:ip:"))).toBe(true);
  });
});

describe("getProgressiveDelay", () => {
  it("returns 0 delay for 0-4 attempts", () => {
    expect(getProgressiveDelay(0)).toBe(0);
    expect(getProgressiveDelay(3)).toBe(0);
    expect(getProgressiveDelay(4)).toBe(0);
  });

  it("returns 1000ms delay for 5-7 attempts", () => {
    expect(getProgressiveDelay(5)).toBe(1000);
    expect(getProgressiveDelay(6)).toBe(1000);
    expect(getProgressiveDelay(7)).toBe(1000);
  });

  it("returns 2000ms delay for 8-9 attempts", () => {
    expect(getProgressiveDelay(8)).toBe(2000);
    expect(getProgressiveDelay(9)).toBe(2000);
  });

  it("returns 0 delay for 10+ attempts (already locked out)", () => {
    expect(getProgressiveDelay(10)).toBe(0);
    expect(getProgressiveDelay(15)).toBe(0);
  });
});

describe("checkRegistrationRate", () => {
  it("allows registration within limit", async () => {
    mockGet.mockResolvedValue("2");

    const result = await checkRegistrationRate("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("denies registration when limit exceeded", async () => {
    mockGet.mockResolvedValue("5");

    const result = await checkRegistrationRate("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe("checkPasswordResetRate", () => {
  it("allows reset within limit", async () => {
    mockGet.mockResolvedValue("3");

    const result = await checkPasswordResetRate("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("denies reset when limit exceeded", async () => {
    mockGet.mockResolvedValue("6");

    const result = await checkPasswordResetRate("1.2.3.4");
    expect(result.allowed).toBe(false);
  });
});
