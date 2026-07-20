import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("../../services/passwordService.js", () => ({
  validatePassword: vi.fn((pw: string) => pw),
  hashPassword: vi.fn().mockResolvedValue("$argon2id$mocked"),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("fixed-uuid"),
}));

const mockReadFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
}));

let exitCodeResult = 0;

vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
  exitCodeResult = code ?? 0;
  throw new Error(`process.exit(${code})`);
}) as (code?: number | undefined) => never);

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

async function runProvision(): Promise<number> {
  exitCodeResult = 0;
  await import("../provisionUser.js");
  await new Promise((resolve) => setTimeout(resolve, 100));
  return exitCodeResult;
}

const unhandledRejectionHandler = vi.fn();
process.on("unhandledRejection", unhandledRejectionHandler);

describe("provisionUser CLI", () => {
  beforeEach(() => {
    mockClientQuery.mockReset();
    mockReadFileSync.mockReset();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    exitCodeResult = 0;
    unhandledRejectionHandler.mockClear();
  });

  it("refuses without --production flag", async () => {
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--email",
      "admin@test.com",
      "--password-stdin",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith("Refusing to run without --production flag.");
  });

  it("refuses without --email", async () => {
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--password-stdin",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    );
  });

  it("refuses --password flag", async () => {
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--email",
      "admin@test.com",
      "--password",
      "secret",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "Do not pass passwords as command-line arguments. Use --password-file or --password-stdin.",
    );
  });

  it("refuses without password source", async () => {
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--email",
      "admin@test.com",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "Provide --password-file <path> or --password-stdin.",
    );
  });

  it("succeeds with --password-stdin", async () => {
    const mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn(
        (
          event: string,
          cb: (...args: unknown[]) => void,
        ) => {
          if (event === "data") {
            setTimeout(() => cb("MySecurePass123!@#\n"), 0);
          }
          if (event === "end") {
            setTimeout(() => cb(), 10);
          }
          return mockStdin;
        },
      ),
    };
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--email",
      "admin@test.com",
      "--password-stdin",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(0);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      expect.arrayContaining([
        "fixed-uuid",
        "admin@test.com",
        "$argon2id$mocked",
      ]),
    );
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO collections"),
      expect.arrayContaining(["fixed-uuid", "fixed-uuid"]),
    );
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO preferences"),
      expect.arrayContaining(["fixed-uuid"]),
    );
    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(console.log).toHaveBeenCalledWith(
      "User provisioned successfully.",
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("succeeds with --password-file", async () => {
    mockReadFileSync.mockReturnValue("MySecurePass123!@#\n");

    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--email",
      "admin@test.com",
      "--password-file",
      "/tmp/pass.txt",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(0);
    expect(mockReadFileSync).toHaveBeenCalledWith("/tmp/pass.txt", "utf8");
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(console.log).toHaveBeenCalledWith(
      "User provisioned successfully.",
    );
  });

  it("rolls back and exits on DB failure", async () => {
    mockClientQuery.mockRejectedValueOnce(new Error("Connection lost"));

    const mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn(
        (
          event: string,
          cb: (...args: unknown[]) => void,
        ) => {
          if (event === "data") {
            setTimeout(() => cb("MySecurePass123!@#\n"), 0);
          }
          if (event === "end") {
            setTimeout(() => cb(), 10);
          }
          return mockStdin;
        },
      ),
    };
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
    });

    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "provisionUser.ts",
      "--production",
      "--email",
      "admin@test.com",
      "--password-stdin",
    ]);

    const exitCode = await runProvision();

    expect(exitCode).toBe(1);
    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to provision user:",
      "Connection lost",
    );
  });
});
