import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  },
}));

const RESET_LINK = "https://planner.test/reset-password?token=abc123";

// The module reads RESEND_API_KEY once at import time to decide whether a
// client exists at all, so each configuration needs its own fresh import.
async function loadService(apiKey: string) {
  vi.resetModules();
  vi.doMock("../../config.js", () => ({
    RESEND_API_KEY: apiKey,
    EMAIL_FROM: "noreply@planner.test",
  }));
  return import("../emailService.js");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
});

afterEach(() => {
  vi.doUnmock("../../config.js");
  vi.restoreAllMocks();
});

describe("sendPasswordResetEmail - no API key", () => {
  it("logs the link and never calls Resend", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { sendPasswordResetEmail } = await loadService("");

    await sendPasswordResetEmail("user@example.com", RESET_LINK);

    expect(mockSend).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining(RESET_LINK));
    expect(info).toHaveBeenCalledWith(expect.stringContaining("user@example.com"));
  });
});

describe("sendPasswordResetEmail - configured", () => {
  it("sends from EMAIL_FROM to the recipient with the link in both bodies", async () => {
    const { sendPasswordResetEmail } = await loadService("re_test_key");

    await sendPasswordResetEmail("user@example.com", RESET_LINK);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(payload.from).toBe("noreply@planner.test");
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toBe("Reset your Planner password");
    expect(payload.html).toContain(RESET_LINK);
    expect(payload.text).toContain(RESET_LINK);
  });

  it("swallows a thrown transport error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockRejectedValueOnce(new Error("network down"));
    const { sendPasswordResetEmail } = await loadService("re_test_key");

    await expect(sendPasswordResetEmail("user@example.com", RESET_LINK)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });

  it("swallows an error returned in the Resend response body", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "domain not verified" } });
    const { sendPasswordResetEmail } = await loadService("re_test_key");

    await expect(sendPasswordResetEmail("user@example.com", RESET_LINK)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("domain not verified"));
  });
});
