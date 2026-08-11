import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./testUtils.js";

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "test-user";
    next();
  },
}));

const mockListStatuses = vi.fn();
const mockCreateStatus = vi.fn();
const mockEnsureCollectionStatuses = vi.fn();
const mockUpdateStatus = vi.fn();
const mockDeleteStatus = vi.fn();

vi.mock("../../services/statusService.js", () => ({
  listStatuses: (...args: unknown[]) => mockListStatuses(...args),
  createStatus: (...args: unknown[]) => mockCreateStatus(...args),
  ensureCollectionStatuses: (...args: unknown[]) => mockEnsureCollectionStatuses(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  deleteStatus: (...args: unknown[]) => mockDeleteStatus(...args),
}));

import statusRoutes from "../statuses.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { AppError } from "../../utils/AppError.js";

const app = createApp(statusRoutes, "/api/v1");
app.use(errorHandler);

describe("statuses routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/collections/:id/statuses → calls listStatuses", async () => {
    mockListStatuses.mockResolvedValue([{ id: "st1", name: "Todo" }]);
    const res = await request(app).get("/api/v1/collections/c1/statuses");
    expect(res.status).toBe(200);
    expect(mockListStatuses).toHaveBeenCalledWith("c1", "test-user");
  });

  it("POST /api/v1/collections/:id/statuses → calls createStatus, returns 201", async () => {
    mockCreateStatus.mockResolvedValue({ id: "st1", name: "New Status" });
    const res = await request(app).post("/api/v1/collections/c1/statuses").send({ name: "New Status" });
    expect(res.status).toBe(201);
    expect(mockCreateStatus).toHaveBeenCalledWith("c1", "test-user", { name: "New Status" });
  });

  it("POST /api/v1/collections/:id/statuses/seed → calls ensureCollectionStatuses", async () => {
    mockEnsureCollectionStatuses.mockResolvedValue([{ id: "st1" }, { id: "st2" }]);
    const res = await request(app).post("/api/v1/collections/c1/statuses/seed");
    expect(res.status).toBe(200);
    expect(mockEnsureCollectionStatuses).toHaveBeenCalledWith("c1", "test-user");
  });

  it("PATCH /api/v1/statuses/:id → calls updateStatus", async () => {
    mockUpdateStatus.mockResolvedValue({ id: "st1", name: "Renamed" });
    const res = await request(app).patch("/api/v1/statuses/st1").send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockUpdateStatus).toHaveBeenCalledWith("st1", "test-user", { name: "Renamed" });
  });

  it("DELETE /api/v1/statuses/:id → calls deleteStatus without reassignTo", async () => {
    mockDeleteStatus.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/statuses/st1");
    expect(res.status).toBe(200);
    expect(mockDeleteStatus).toHaveBeenCalledWith("st1", "test-user", { reassignToStatusId: undefined });
  });

  it("DELETE /api/v1/statuses/:id?reassignTo=<uuid> → passes reassignToStatusId", async () => {
    mockDeleteStatus.mockResolvedValue({ success: true });
    const res = await request(app).delete("/api/v1/statuses/st1?reassignTo=st2");
    expect(res.status).toBe(200);
    expect(mockDeleteStatus).toHaveBeenCalledWith("st1", "test-user", { reassignToStatusId: "st2" });
  });

  it("propagates a 409 from deleteStatus (last status)", async () => {
    mockDeleteStatus.mockRejectedValue(
      new AppError({
        code: "CONFLICT",
        message: "Cannot delete the last status in a collection",
        statusCode: 409,
      }),
    );
    const res = await request(app).delete("/api/v1/statuses/st1");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});
