import { describe, it, expect, vi, beforeEach } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: { readFileSync: readFileSyncMock },
}));

describe("BUILD_VERSION", () => {
  beforeEach(() => {
    vi.resetModules();
    readFileSyncMock.mockReset();
  });

  it("reads and trims the BUILD_ID file when present", async () => {
    readFileSyncMock.mockReturnValue("20260725T120000Z\n");
    const { BUILD_VERSION } = await import("../buildInfo.js");
    expect(BUILD_VERSION).toBe("20260725T120000Z");
  });

  it("falls back to 'dev' when the file is missing (dev image never writes it)", async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { BUILD_VERSION } = await import("../buildInfo.js");
    expect(BUILD_VERSION).toBe("dev");
  });

  it("falls back to 'dev' when the file is empty", async () => {
    readFileSyncMock.mockReturnValue("   ");
    const { BUILD_VERSION } = await import("../buildInfo.js");
    expect(BUILD_VERSION).toBe("dev");
  });
});
