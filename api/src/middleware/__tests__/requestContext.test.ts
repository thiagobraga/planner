import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestContext, currentSourceId } from "../requestContext.js";

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
});
