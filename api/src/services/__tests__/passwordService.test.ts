import { describe, it, expect } from "vitest";

import {
  validatePassword,
  hashPassword,
  verifyArgon2id,
  generateResetToken,
} from "../passwordService.js";

describe("validatePassword", () => {
  it("accepts a valid long passphrase", () => {
    const pw = validatePassword("correct horse battery staple");
    expect(pw).toBe("correct horse battery staple");
  });

  it("rejects a password shorter than 15 characters", () => {
    expect(() => validatePassword("Short1!")).toThrow(/at least 15/);
  });

  it("rejects a password longer than 128 characters", () => {
    expect(() => validatePassword("a".repeat(129))).toThrow(/at most 128/);
  });

  it("rejects a blocklisted password", () => {
    expect(() => validatePassword("password123456789!")).toThrow(/too common/);
  });

  it("rejects planner project name in password", () => {
    expect(() => validatePassword("MyPlannerPassphrase1!")).toThrow(/too common/);
  });

  it("normalises NFC-equivalent input", () => {
    const composed = "\u00E9" + "a".repeat(15); // é + 15 a's = 16 chars, NFC
    const decomposed = "\u0065\u0301" + "a".repeat(15); // é + 15 a's = 17 chars, NFD
    const result1 = validatePassword(composed);
    const result2 = validatePassword(decomposed);
    // Both should NFC-normalize to é + 15 a's = 16 chars
    expect(result1).toBe(result2);
    expect(result1.normalize("NFC")).toBe(result1);
  });

  it("allows spaces, unicode, and paste", () => {
    const pw = validatePassword("  spaces  漢字  パスワード   ".padEnd(15, "x"));
    expect(pw).toBeTruthy();
    expect(pw.length).toBeGreaterThanOrEqual(15);
  });
});

describe("hashPassword and verifyArgon2id", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toContain("$argon2id$");
    const ok = await verifyArgon2id(hash, "correct horse battery staple");
    expect(ok).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const ok = await verifyArgon2id(hash, "wrong password");
    expect(ok).toBe(false);
  });
});

describe("generateResetToken", () => {
  it("generates a 64-character hex token", () => {
    const token = generateResetToken();
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });
});
