import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import {
  createPersonalToken,
  listPersonalTokens,
  validatePersonalToken,
  revokePersonalToken,
  revokeAllUserTokens,
  tokenNeedsTouch,
  touchPersonalToken,
  deleteExpiredPersonalTokens,
} from "../apiTokenService.js";
import { hashToken } from "../sessionService.js";

const createdUserIds: string[] = [];

async function createTestUser(): Promise<string> {
  const userId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
    [userId, `apitoken-${userId}@example.com`, "hashed-pass"],
  );
  createdUserIds.push(userId);
  return userId;
}

const readInput = { name: "Claude Desktop", scopes: ["read"], expiresInDays: 90 };

describe("apiTokenService (real PostgreSQL)", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [createdUserIds]);
    createdUserIds.length = 0;
  });

  describe("createPersonalToken", () => {
    it("returns a plnr_ raw token and stores only its hash", async () => {
      const { token, rawToken } = await createPersonalToken(userA, readInput);

      expect(rawToken).toMatch(/^plnr_[A-Za-z0-9_-]{40,}$/);
      expect(token.tokenPrefix).toBe(rawToken.slice(0, 13));
      expect(token.scopes).toEqual(["read"]);
      expect(token.lastUsedAt).toBeNull();

      const row = await pool.query("SELECT token_hash FROM api_tokens WHERE id = $1", [token.id]);
      expect(row.rows[0].token_hash).toBe(hashToken(rawToken));
      expect(row.rows[0].token_hash).not.toContain(rawToken);
    });

    it("sets expiry from expiresInDays and allows never-expiring tokens", async () => {
      const { token: ninety } = await createPersonalToken(userA, readInput);
      const days = (new Date(ninety.expiresAt!).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89.9);
      expect(days).toBeLessThan(90.1);

      const { token: never } = await createPersonalToken(userA, { ...readInput, expiresInDays: null });
      expect(never.expiresAt).toBeNull();
    });

    it("implies read when write is requested", async () => {
      const { token } = await createPersonalToken(userA, { ...readInput, scopes: ["write"] });
      expect(token.scopes).toEqual(["read", "write"]);
    });

    it.each([
      [{ ...readInput, name: "  " }, "name"],
      [{ ...readInput, name: "x".repeat(101) }, "name"],
      [{ ...readInput, scopes: [] }, "scopes"],
      [{ ...readInput, scopes: ["admin"] }, "scopes"],
      [{ ...readInput, expiresInDays: 7 }, "expiresInDays"],
      [{ name: "n", scopes: ["read"] }, "expiresInDays"],
    ])("rejects invalid input %#", async (input, field) => {
      await expect(createPersonalToken(userA, input)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        details: expect.arrayContaining([expect.objectContaining({ field })]),
      });
    });

    it("caps active tokens at 20 per user", async () => {
      for (let i = 0; i < 20; i++) {
        await createPersonalToken(userA, { ...readInput, name: `t${i}` });
      }
      await expect(createPersonalToken(userA, readInput)).rejects.toMatchObject({
        code: "TOKEN_LIMIT_REACHED",
        statusCode: 409,
      });
      // Other users are unaffected
      await expect(createPersonalToken(userB, readInput)).resolves.toBeDefined();
    });
  });

  describe("listPersonalTokens", () => {
    it("lists only the caller's active tokens, newest first, without hashes", async () => {
      const { token: first } = await createPersonalToken(userA, { ...readInput, name: "first" });
      const { token: second } = await createPersonalToken(userA, { ...readInput, name: "second" });
      const { token: revoked } = await createPersonalToken(userA, { ...readInput, name: "revoked" });
      await createPersonalToken(userB, readInput);
      await revokePersonalToken(userA, revoked.id);

      const tokens = await listPersonalTokens(userA);

      expect(tokens.map((t) => t.id)).toEqual([second.id, first.id]);
      expect(Object.keys(tokens[0])).not.toContain("tokenHash");
    });
  });

  describe("validatePersonalToken", () => {
    it("resolves a valid token to its user and scopes", async () => {
      const { token, rawToken } = await createPersonalToken(userA, { ...readInput, scopes: ["read", "write"] });

      const ctx = await validatePersonalToken(rawToken);

      expect(ctx).toMatchObject({ userId: userA, tokenId: token.id, name: "Claude Desktop", scopes: ["read", "write"] });
    });

    it("rejects unknown, non-prefixed, revoked and expired tokens", async () => {
      const { token, rawToken } = await createPersonalToken(userA, readInput);
      const { token: expired, rawToken: expiredRaw } = await createPersonalToken(userA, readInput);
      await pool.query("UPDATE api_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [expired.id]);

      expect(await validatePersonalToken("plnr_unknown")).toBeNull();
      expect(await validatePersonalToken(rawToken.slice(5))).toBeNull();
      expect(await validatePersonalToken(expiredRaw)).toBeNull();

      await revokePersonalToken(userA, token.id);
      expect(await validatePersonalToken(rawToken)).toBeNull();
    });

    it("rejects tokens of a disabled user", async () => {
      const { rawToken } = await createPersonalToken(userA, readInput);
      await pool.query("UPDATE users SET disabled_at = NOW() WHERE id = $1", [userA]);

      expect(await validatePersonalToken(rawToken)).toBeNull();
    });
  });

  describe("touch", () => {
    it("needs a touch when never used or stale, and records last use", async () => {
      const { token, rawToken } = await createPersonalToken(userA, readInput);
      const ctx = (await validatePersonalToken(rawToken))!;
      expect(tokenNeedsTouch(ctx)).toBe(true);

      await touchPersonalToken(token.id);
      const touched = (await validatePersonalToken(rawToken))!;
      expect(touched.lastUsedAt).not.toBeNull();
      expect(tokenNeedsTouch(touched)).toBe(false);
      expect(tokenNeedsTouch(touched, new Date(Date.now() + 24 * 60 * 60 * 1000))).toBe(true);
    });
  });

  describe("revocation", () => {
    it("404s when revoking another user's token", async () => {
      const { token, rawToken } = await createPersonalToken(userB, readInput);

      await expect(revokePersonalToken(userA, token.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(await validatePersonalToken(rawToken)).not.toBeNull();
    });

    it("revokeAllUserTokens revokes every active token of that user only", async () => {
      const a1 = await createPersonalToken(userA, readInput);
      const a2 = await createPersonalToken(userA, readInput);
      const b1 = await createPersonalToken(userB, readInput);

      await revokeAllUserTokens(userA, "admin-disable");

      expect(await validatePersonalToken(a1.rawToken)).toBeNull();
      expect(await validatePersonalToken(a2.rawToken)).toBeNull();
      expect(await validatePersonalToken(b1.rawToken)).not.toBeNull();
      const reasons = await pool.query("SELECT DISTINCT revoke_reason FROM api_tokens WHERE user_id = $1", [userA]);
      expect(reasons.rows).toEqual([{ revoke_reason: "admin-disable" }]);
    });

    it("deleteExpiredPersonalTokens removes only rows dead for over 30 days", async () => {
      const old = await createPersonalToken(userA, readInput);
      const recent = await createPersonalToken(userA, readInput);
      await pool.query("UPDATE api_tokens SET revoked_at = NOW() - INTERVAL '31 days' WHERE id = $1", [old.token.id]);
      await pool.query("UPDATE api_tokens SET revoked_at = NOW() - INTERVAL '1 day' WHERE id = $1", [recent.token.id]);

      await deleteExpiredPersonalTokens();

      const ids = (await pool.query("SELECT id FROM api_tokens WHERE user_id = $1", [userA])).rows.map((r) => r.id);
      expect(ids).toEqual([recent.token.id]);
    });
  });
});
