import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/pool.js", () => ({
  default: { query: vi.fn() },
}));

vi.mock("../../db/redis.js", () => ({
  redisClient: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPubClient: { publish: vi.fn().mockResolvedValue(1) },
  redisSubClient: { subscribe: vi.fn().mockResolvedValue(undefined) },
}));

import { buildEvent, publishEvent } from "../syncService.js";
import { redisPubClient } from "../../db/redis.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncService.buildEvent", () => {
  it("fills id and emittedAt for all required fields", () => {
    const e = buildEvent({
      entityType: "task",
      eventType: "updated",
      entityId: "t1",
      userId: "u1",
      collectionId: "p1",
      payload: { foo: "bar" },
    });
    expect(e.id).toBeDefined();
    expect(e.emittedAt).toBeDefined();
    expect(new Date(e.emittedAt).toString()).not.toBe("Invalid Date");
    expect(e.entityType).toBe("task");
    expect(e.eventType).toBe("updated");
  });

  it("respects explicit id when provided", () => {
    const e = buildEvent({
      id: "custom-id",
      entityType: "collection",
      eventType: "created",
      entityId: "p1",
      userId: "u1",
    });
    expect(e.id).toBe("custom-id");
  });

  it("handles missing optional fields (collectionId, payload)", () => {
    const e = buildEvent({
      entityType: "task",
      eventType: "deleted",
      entityId: "t1",
      userId: "u1",
    });
    expect(e.collectionId).toBeUndefined();
    expect(e.payload).toBeUndefined();
  });
});

describe("syncService.publishEvent", () => {
  it("publishes JSON-encoded event to Redis channel", async () => {
    const event = buildEvent({
      entityType: "task",
      eventType: "deleted",
      entityId: "t1",
      userId: "u1",
    });

    await publishEvent(event);

    const call = (redisPubClient.publish as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("sync");
    expect(JSON.parse(call[1] as string)).toEqual(event);
  });

  it("logs error and re-throws when Redis publish fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (redisPubClient.publish as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Redis down"));

    const event = buildEvent({
      entityType: "task",
      eventType: "deleted",
      entityId: "t1",
      userId: "u1",
    });

    await expect(publishEvent(event)).rejects.toThrow("Redis down");
    expect(consoleSpy).toHaveBeenCalledWith("[sync] publishEvent failed:", expect.any(Error));
    consoleSpy.mockRestore();
  });
});
