import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError.js";
import { errorHandler } from "../errorHandler.js";

describe("errorHandler middleware", () => {
  let req: Request;
  let res: Response;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    json = vi.fn();
    status = vi.fn(() => ({ json }));
    req = {} as Request;
    res = { status } as unknown as Response;
    next = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("handles AppError with statusCode and code", () => {
    const err = new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "invalid input",
    });

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: "invalid input",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("includes details when AppError has them", () => {
    const err = new AppError({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: [{ field: "name", issue: "too short" }],
    });

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [{ field: "name", issue: "too short" }],
      },
    });
  });

  it("handles generic Error with 500 and requestId", () => {
    const err = new Error("unexpected");

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    const callArg = (json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.error.code).toBe("INTERNAL_ERROR");
    expect(callArg.error.message).toBe("An unexpected error occurred");
    expect(callArg.error.requestId).toBeDefined();
    expect(typeof callArg.error.requestId).toBe("string");
    expect(console.error).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
