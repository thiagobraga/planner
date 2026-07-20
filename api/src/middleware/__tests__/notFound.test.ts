import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { notFound } from "../notFound.js";

describe("notFound middleware", () => {
  it("returns 404 with correct error shape", () => {
    const req = {} as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as Response;

    notFound(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    });
  });
});
