import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestContext, currentSourceId, setActor, currentActor } from "../requestContext.js";
import { buildEvent } from "../../services/syncService.js";

function mockReq(headers?: Record<string, string>): Request {
  return { headers: headers ?? {} } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe("requestContext middleware", () => {
  it("stores sourceId from X-Socket-Id header", () => {
    const req = mockReq({ "x-socket-id": "socket-abc" });
    let stored: string | undefined;
    const next: NextFunction = () => {
      stored = currentSourceId();
    };

    requestContext(req, mockRes(), next);

    expect(stored).toBe("socket-abc");
  });

  it("sets undefined sourceId when X-Socket-Id is absent", () => {
    const req = mockReq({});
    let stored: string | undefined = "should-be-cleared";
    const next: NextFunction = () => {
      stored = currentSourceId();
    };

    requestContext(req, mockRes(), next);

    expect(stored).toBeUndefined();
  });

  it("sets undefined sourceId for array header values", () => {
    const req = mockReq({ "x-socket-id": ["a", "b"] } as unknown as Record<string, string>);
    let stored: string | undefined = "should-be-cleared";
    const next: NextFunction = () => {
      stored = currentSourceId();
    };

    requestContext(req, mockRes(), next);

    expect(stored).toBeUndefined();
  });

  it("isolates context between concurrent requests", () => {
    const reqA = mockReq({ "x-socket-id": "socket-a" });
    const reqB = mockReq({ "x-socket-id": "socket-b" });

    let resultA: string | undefined;
    let resultB: string | undefined;

    requestContext(reqA, mockRes(), () => {
      resultA = currentSourceId();
      requestContext(reqB, mockRes(), () => {
        resultB = currentSourceId();
      });
      expect(currentSourceId()).toBe("socket-a");
    });

    expect(resultA).toBe("socket-a");
    expect(resultB).toBe("socket-b");
  });

  describe("actor", () => {
    const actor = { type: "token" as const, tokenId: "tok-1", label: "Claude Desktop" };

    it("is visible to code awaited later in the same request", async () => {
      let seen: unknown;
      await new Promise<void>((resolve) => {
        requestContext(mockReq(), mockRes(), async () => {
          setActor(actor);
          await new Promise((r) => setTimeout(r, 5));
          seen = currentActor();
          resolve();
        });
      });
      expect(seen).toEqual(actor);
    });

    it("does not leak into a concurrent request", async () => {
      const seen: unknown[] = [];
      await Promise.all([
        new Promise<void>((resolve) => {
          requestContext(mockReq(), mockRes(), async () => {
            setActor(actor);
            await new Promise((r) => setTimeout(r, 10));
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          requestContext(mockReq(), mockRes(), async () => {
            await new Promise((r) => setTimeout(r, 15));
            seen.push(currentActor());
            resolve();
          });
        }),
      ]);
      expect(seen).toEqual([undefined]);
    });

    it("is a no-op outside a request", () => {
      setActor(actor);
      expect(currentActor()).toBeUndefined();
    });

    it("names the agent on sync events without exposing the token id", () => {
      let event: ReturnType<typeof buildEvent> | undefined;
      requestContext(mockReq(), mockRes(), () => {
        setActor(actor);
        event = buildEvent({ entityType: "task", eventType: "created", entityId: "t1", userId: "u1" });
      });
      expect(event?.actor).toEqual({ type: "token", label: "Claude Desktop" });
      expect(JSON.stringify(event)).not.toContain("tok-1");
    });
  });
});
