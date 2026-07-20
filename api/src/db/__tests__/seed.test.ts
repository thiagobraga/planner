import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
    end: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$mocked_hash"),
  },
}));

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(process, "exit").mockImplementation(() => {});

describe("seed script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exits when user already exists", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "user-1" }] });

    await import("../seed.js");

    await vi.waitFor(() => {
      expect(console.log).toHaveBeenCalledWith("Seed user already exists.");
    });
  });

  it("creates seed data when user does not exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockClientQuery.mockResolvedValue(undefined);

    await import("../seed.js");

    await vi.waitFor(() => {
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    });

    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      expect.arrayContaining([
        expect.any(String),
        "dev@planner.local",
        "$2b$mocked_hash",
        "Dev User",
      ]),
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  it("rolls back and exits on transaction failure", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockClientQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error("DB error")); // INSERT fails

    await import("../seed.js");

    await vi.waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Seeding failed:",
        expect.any(Error),
      );
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
  });
});
