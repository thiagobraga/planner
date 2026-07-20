import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrate } from "../migrate.js";

const mockQuery = vi.hoisted(() => vi.fn());
const mockClientQuery = vi.hoisted(() => vi.fn());
const mockRelease = vi.hoisted(() => vi.fn());
const mockConnect = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  }),
);
const mockEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
    end: mockEnd,
  },
}));

const mockReaddirSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());

vi.mock("node:fs", () => ({
  default: {
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  },
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

describe("migrate", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockEnd.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    vi.spyOn(console, "log").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
  });

  it("applies all pending migrations", async () => {
    mockReaddirSync.mockReturnValue(["001_init.sql", "002_add_index.sql"]);
    mockReadFileSync.mockReturnValue("CREATE TABLE test (id INT)");
    mockQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] });

    await migrate();

    expect(mockClientQuery).toHaveBeenCalledTimes(8);
    expect(mockClientQuery).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockClientQuery).toHaveBeenNthCalledWith(4, "COMMIT");
    expect(mockClientQuery).toHaveBeenNthCalledWith(5, "BEGIN");
    expect(mockClientQuery).toHaveBeenNthCalledWith(8, "COMMIT");
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it("skips already-applied migrations", async () => {
    mockReaddirSync.mockReturnValue(["001_init.sql", "002_add_index.sql"]);
    mockQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          { filename: "001_init.sql" },
          { filename: "002_add_index.sql" },
        ],
      });

    await migrate();

    expect(mockClientQuery).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it("rolls back on migration failure and exits with code 1", async () => {
    mockReaddirSync.mockReturnValue(["001_init.sql", "002_add_index.sql"]);
    mockReadFileSync.mockReturnValue("CREATE TABLE test (id INT)");
    mockQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] });
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SQL error"));

    await expect(migrate()).rejects.toThrow("SQL error");

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(mockEnd).not.toHaveBeenCalled();
  });
});
