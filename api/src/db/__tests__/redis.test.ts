import { describe, it, expect, vi } from "vitest";

const mockConnect = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("redis", () => ({
  createClient: vi.fn().mockReturnValue({
    connect: mockConnect,
    on: vi.fn(),
    subscribe: vi.fn(),
    psubscribe: vi.fn(),
    isReady: false,
  }),
}));

import { redisClient, redisPubClient, redisSubClient, connectRedis } from "../redis.js";
import { createClient } from "redis";

describe("redis clients", () => {
  it("redisClient, redisPubClient, redisSubClient are defined", () => {
    expect(redisClient).not.toBeNull();
    expect(redisClient).toBeDefined();
    expect(redisPubClient).not.toBeNull();
    expect(redisPubClient).toBeDefined();
    expect(redisSubClient).not.toBeNull();
    expect(redisSubClient).toBeDefined();
  });

  it("connectRedis calls connect on all three clients", async () => {
    expect(createClient).toHaveBeenCalledTimes(3);

    mockConnect.mockClear();
    await connectRedis();
    expect(mockConnect).toHaveBeenCalledTimes(3);
  });

  it("connectRedis handles connection errors gracefully", async () => {
    mockConnect.mockClear();
    mockConnect.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(connectRedis()).rejects.toThrow("Connection refused");
  });
});
