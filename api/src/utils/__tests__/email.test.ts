import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isValidEmail, EMAIL_MAX_LENGTH } from "../email.js";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
    expect(isValidEmail("weird!#$%&'*+/=?^_`{|}~-@example.com")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("no-domain@")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("two@at@example.com")).toBe(false);
    expect(isValidEmail("spaces in@example.com")).toBe(false);
    expect(isValidEmail("trailing.dot@example.com.")).toBe(false);
    expect(isValidEmail("double..dot@example..com")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(12345)).toBe(false);
    expect(isValidEmail({ toString: () => "a@b.com" })).toBe(false);
  });

  it("rejects addresses longer than the RFC 5321 limit", () => {
    const local = "a".repeat(EMAIL_MAX_LENGTH - "@example.com".length);
    expect(isValidEmail(`${local}@example.com`)).toBe(true);
    expect(isValidEmail(`${local}a@example.com`)).toBe(false);
  });

  it("stays fast on the ReDoS payload shape reported by CodeQL", () => {
    // Under EMAIL_MAX_LENGTH, so this exercises the regex itself and not the length guard.
    const withinLimit = `!@!.${"!.".repeat(100)}`;
    // Over the limit: the length guard alone must reject it without touching the regex.
    const oversized = `!@!.${"!.".repeat(20000)}`;

    const started = performance.now();
    expect(isValidEmail(withinLimit)).toBe(false);
    expect(isValidEmail(oversized)).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("never takes super-linear time on arbitrary input", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (candidate) => {
        const started = performance.now();
        isValidEmail(candidate);
        return performance.now() - started < 50;
      }),
      { numRuns: 500 },
    );
  });
});
