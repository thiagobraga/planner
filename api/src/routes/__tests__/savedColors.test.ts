import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListSavedColors = vi.fn();
const mockAddSavedColor = vi.fn();

vi.mock("../../services/savedColorService.js", () => ({
  listSavedColors: (...args: unknown[]) => mockListSavedColors(...args),
  addSavedColor: (...args: unknown[]) => mockAddSavedColor(...args),
}));

import savedColorRoutes from "../savedColors.js";
import { errorHandler } from "../../middleware/errorHandler.js";

const app = createApp(savedColorRoutes, "/api/v1/saved-colors");
app.use(errorHandler);

describe("saved colors routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/saved-colors → calls listSavedColors for the authenticated user", async () => {
    mockListSavedColors.mockResolvedValue(["#d56b64", "#65788a"]);

    const res = await request(app).get("/api/v1/saved-colors");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["#d56b64", "#65788a"]);
    expect(mockListSavedColors).toHaveBeenCalledWith("test-user");
  });

  it("POST /api/v1/saved-colors → calls addSavedColor, returns 201 with the updated list", async () => {
    mockAddSavedColor.mockResolvedValue(["#c98079", "#d56b64"]);

    const res = await request(app).post("/api/v1/saved-colors").send({ color: "#c98079" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(["#c98079", "#d56b64"]);
    expect(mockAddSavedColor).toHaveBeenCalledWith("test-user", "#c98079");
  });

  it("POST /api/v1/saved-colors with no body → forwards undefined so the service validates", async () => {
    mockAddSavedColor.mockResolvedValue([]);

    await request(app).post("/api/v1/saved-colors").send({});

    expect(mockAddSavedColor).toHaveBeenCalledWith("test-user", undefined);
  });

  it("surfaces service validation errors through the error handler", async () => {
    const { AppError } = await import("../../utils/AppError.js");
    mockAddSavedColor.mockRejectedValue(
      new AppError({ code: "VALIDATION_ERROR", message: "Validation failed", statusCode: 400 }),
    );

    const res = await request(app).post("/api/v1/saved-colors").send({ color: "nope" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
