import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockDel = vi.fn();

const state = vi.hoisted(() => ({
  isReady: true,
  isProduction: false,
  disableInDev: false,
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: {
    get: (...args: unknown[]) => mockGet(...args),
    incr: (...args: unknown[]) => mockIncr(...args),
    expire: (...args: unknown[]) => mockExpire(...args),
    del: (...args: unknown[]) => mockDel(...args),
    get isReady() {
      return state.isReady;
    },
  },
  redisPubClient: {
    publish: vi.fn(),
  },
}));

vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config.js")>()),
  get IS_PRODUCTION() {
    return state.isProduction;
  },
  get DISABLE_RATE_LIMITS_IN_DEV() {
    return state.disableInDev;
  },
}));

import {
  checkLoginRate,
  incrementLoginAttempts,
  clearLoginRate,
  getProgressiveDelay,
  checkRegistrationRate,
  incrementRegistrationAttempts,
  checkPasswordResetRate,
  incrementPasswordResetAttempts,
  isMemFallbackActive,
  resetMemFallbackFlag,
} from "../rateLimitService.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetMemFallbackFlag();
  state.isReady = true;
  state.isProduction = false;
  state.disableInDev = false;
  mockGet.mockResolvedValue(null);
  mockIncr.mockResolvedValue(1);
  mockExpire.mockResolvedValue(true);
  mockDel.mockResolvedValue(1);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it("counts in-memory attempts when Redis is not ready", async () => {
    state.isReady = false;
    await incrementLoginAttempts("mem@example.com", "5.6.7.8");

    const result = await checkLoginRate("mem@example.com", "5.6.7.8");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
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

  it("skips the expire when the key already existed", async () => {
    mockIncr.mockResolvedValue(3);

    await incrementLoginAttempts("user@example.com", "1.2.3.4");

    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("counts in memory when Redis is not ready", async () => {
    state.isReady = false;

    await incrementLoginAttempts("mem@example.com", "5.6.7.8");

    expect(mockIncr).not.toHaveBeenCalled();
  });
});

describe("clearLoginRate", () => {
  it("deletes both account and IP keys", async () => {
    await clearLoginRate("user@example.com", "1.2.3.4");

    const delCalls = mockDel.mock.calls.map((c: string[]) => c[0]);
    expect(delCalls.some((k: string) => k.startsWith("rl:acct:"))).toBe(true);
    expect(delCalls.some((k: string) => k.startsWith("rl:login:ip:"))).toBe(true);
  });

  it("clears in-memory entries when Redis is not ready", async () => {
    state.isReady = false;
    await incrementLoginAttempts("mem@example.com", "5.6.7.8");

    await clearLoginRate("mem@example.com", "5.6.7.8");

    expect(mockDel).not.toHaveBeenCalled();
    const result = await checkLoginRate("mem@example.com", "5.6.7.8");
    expect(result.remaining).toBe(10);
  });

  it("swallows Redis failures while clearing", async () => {
    mockDel.mockRejectedValue(new Error("Redis connection lost"));

    await expect(clearLoginRate("user@example.com", "1.2.3.4")).resolves.toBeUndefined();
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
  it("allows registration with no prior attempts", async () => {
    const result = await checkRegistrationRate("1.2.3.4");
    expect(result).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
  });

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

  it("counts in memory when Redis is not ready", async () => {
    state.isReady = false;
    await incrementRegistrationAttempts("5.6.7.8");

    const result = await checkRegistrationRate("5.6.7.8");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("counts in memory when Redis errors", async () => {
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    const result = await checkRegistrationRate("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("increments the registration key", async () => {
    await incrementRegistrationAttempts("1.2.3.4");

    const keysUsed = mockIncr.mock.calls.map((c: string[]) => c[0]);
    expect(keysUsed).toEqual(["rl:reg:ip:1.2.3.4"]);
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });
});

describe("checkPasswordResetRate", () => {
  it("allows reset with no prior attempts", async () => {
    const result = await checkPasswordResetRate("1.2.3.4");
    expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
  });

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

  it("counts in memory when Redis is not ready", async () => {
    state.isReady = false;
    await incrementPasswordResetAttempts("5.6.7.8");

    const result = await checkPasswordResetRate("5.6.7.8");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("counts in memory when Redis errors", async () => {
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    const result = await checkPasswordResetRate("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("increments the reset key", async () => {
    await incrementPasswordResetAttempts("1.2.3.4");

    const keysUsed = mockIncr.mock.calls.map((c: string[]) => c[0]);
    expect(keysUsed).toEqual(["rl:reset:ip:1.2.3.4"]);
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });
});

describe("rate limits disabled in dev", () => {
  beforeEach(() => {
    state.disableInDev = true;
  });

  it("allows every login check without touching Redis", async () => {
    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result).toEqual({ allowed: true, remaining: 10, retryAfterSeconds: 0 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips incrementing login attempts", async () => {
    await incrementLoginAttempts("user@example.com", "1.2.3.4");
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("skips clearing login rate", async () => {
    await clearLoginRate("user@example.com", "1.2.3.4");
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("allows every registration check without touching Redis", async () => {
    const result = await checkRegistrationRate("1.2.3.4");
    expect(result).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips incrementing registration attempts", async () => {
    await incrementRegistrationAttempts("1.2.3.4");
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("allows every password reset check without touching Redis", async () => {
    const result = await checkPasswordResetRate("1.2.3.4");
    expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips incrementing password reset attempts", async () => {
    await incrementPasswordResetAttempts("1.2.3.4");
    expect(mockIncr).not.toHaveBeenCalled();
  });
});

describe("production fallback", () => {
  beforeEach(() => {
    state.isProduction = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("activates the memory fallback and reports when Redis errors", async () => {
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(isMemFallbackActive()).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it("activates the memory fallback when Redis is not ready", async () => {
    state.isReady = false;

    const result = await checkLoginRate("user@example.com", "1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(isMemFallbackActive()).toBe(true);
  });

  it("counts in memory when incrementing fails on Redis", async () => {
    mockIncr.mockRejectedValue(new Error("Redis connection lost"));
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    await incrementLoginAttempts("mem@example.com", "5.6.7.8");

    const result = await checkLoginRate("mem@example.com", "5.6.7.8");
    expect(result.remaining).toBe(9);
  });

  it("counts in memory in dev when incrementing fails on Redis", async () => {
    state.isProduction = false;
    mockIncr.mockRejectedValue(new Error("Redis connection lost"));
    mockGet.mockRejectedValue(new Error("Redis connection lost"));

    await incrementLoginAttempts("devmem@example.com", "9.9.9.9");

    expect(isMemFallbackActive()).toBe(false);
    const result = await checkLoginRate("devmem@example.com", "9.9.9.9");
    expect(result.remaining).toBe(9);
  });
});

describe("memory store cleanup", () => {
  it("drops expired entries", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const fresh = await import("../rateLimitService.js");
    fresh.resetMemFallbackFlag();
    state.isReady = false;

    await fresh.incrementLoginAttempts("mem@example.com", "5.6.7.8");
    let result = await fresh.checkLoginRate("mem@example.com", "5.6.7.8");
    expect(result.remaining).toBe(9);

    vi.advanceTimersByTime(901_000);

    result = await fresh.checkLoginRate("mem@example.com", "5.6.7.8");
    expect(result.remaining).toBe(10);
  });
});