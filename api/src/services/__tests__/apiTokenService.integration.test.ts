import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import pool from "../../db/pool.js";
import {
  createApiToken,
  listApiTokens,
  validateApiToken,
  revokeApiToken,
  revokeAllUserTokens,
  tokenNeedsTouch,
  touchApiToken,
  deleteExpiredApiTokens,
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

  describe("createApiToken", () => {
    it("returns a plnr_ raw token and stores only its hash", async () => {
      const { token, rawToken } = await createApiToken(userA, readInput);

      expect(rawToken).toMatch(/^plnr_[A-Za-z0-9_-]{40,}$/);
      expect(token.tokenPrefix).toBe(rawToken.slice(0, 13));
      expect(token.scopes).toEqual(["read"]);
      expect(token.lastUsedAt).toBeNull();

      const row = await pool.query("SELECT token_hash FROM api_tokens WHERE id = $1", [token.id]);
      expect(row.rows[0].token_hash).toBe(hashToken(rawToken));
      expect(row.rows[0].token_hash).not.toContain(rawToken);
    });

    it("sets expiry from expiresInDays and allows never-expiring tokens", async () => {
      const { token: ninety } = await createApiToken(userA, readInput);
      const days = (new Date(ninety.expiresAt!).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89.9);
      expect(days).toBeLessThan(90.1);

      const { token: never } = await createApiToken(userA, { ...readInput, expiresInDays: null });
      expect(never.expiresAt).toBeNull();
    });

    it("implies read when write is requested", async () => {
      const { token } = await createApiToken(userA, { ...readInput, scopes: ["write"] });
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
      await expect(createApiToken(userA, input)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        details: expect.arrayContaining([expect.objectContaining({ field })]),
      });
    });

    it("caps active tokens at 20 per user", async () => {
      for (let i = 0; i < 20; i++) {
        await createApiToken(userA, { ...readInput, name: `t${i}` });
      }
      await expect(createApiToken(userA, readInput)).rejects.toMatchObject({
        code: "TOKEN_LIMIT_REACHED",
        statusCode: 409,
      });
      // Other users are unaffected
      await expect(createApiToken(userB, readInput)).resolves.toBeDefined();
    });
  });

  describe("listApiTokens", () => {
    it("lists only the caller's active tokens, newest first, without hashes", async () => {
      const { token: first } = await createApiToken(userA, { ...readInput, name: "first" });
      const { token: second } = await createApiToken(userA, { ...readInput, name: "second" });
      const { token: revoked } = await createApiToken(userA, { ...readInput, name: "revoked" });
      await createApiToken(userB, readInput);
      await revokeApiToken(userA, revoked.id);

      const tokens = await listApiTokens(userA);

      expect(tokens.map((t) => t.id)).toEqual([second.id, first.id]);
      expect(Object.keys(tokens[0])).not.toContain("tokenHash");
    });
  });

  describe("validateApiToken", () => {
    it("resolves a valid token to its user and scopes", async () => {
      const { token, rawToken } = await createApiToken(userA, { ...readInput, scopes: ["read", "write"] });

      const ctx = await validateApiToken(rawToken);

      expect(ctx).toMatchObject({ userId: userA, tokenId: token.id, name: "Claude Desktop", scopes: ["read", "write"] });
    });

    it("rejects unknown, non-prefixed, revoked and expired tokens", async () => {
      const { token, rawToken } = await createApiToken(userA, readInput);
      const { token: expired, rawToken: expiredRaw } = await createApiToken(userA, readInput);
      await pool.query("UPDATE api_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [expired.id]);

      expect(await validateApiToken("plnr_unknown")).toBeNull();
      expect(await validateApiToken(rawToken.slice(5))).toBeNull();
      expect(await validateApiToken(expiredRaw)).toBeNull();

      await revokeApiToken(userA, token.id);
      expect(await validateApiToken(rawToken)).toBeNull();
    });

    it("rejects tokens of a disabled user", async () => {
      const { rawToken } = await createApiToken(userA, readInput);
      await pool.query("UPDATE users SET disabled_at = NOW() WHERE id = $1", [userA]);

      expect(await validateApiToken(rawToken)).toBeNull();
    });
  });

  describe("touch", () => {
    it("needs a touch when never used or stale, and records last use", async () => {
      const { token, rawToken } = await createApiToken(userA, readInput);
      const ctx = (await validateApiToken(rawToken))!;
      expect(tokenNeedsTouch(ctx)).toBe(true);

      await touchApiToken(token.id);
      const touched = (await validateApiToken(rawToken))!;
      expect(touched.lastUsedAt).not.toBeNull();
      expect(tokenNeedsTouch(touched)).toBe(false);
      expect(tokenNeedsTouch(touched, new Date(Date.now() + 24 * 60 * 60 * 1000))).toBe(true);
    });
  });

  describe("revocation", () => {
    it("404s when revoking another user's token", async () => {
      const { token, rawToken } = await createApiToken(userB, readInput);

      await expect(revokeApiToken(userA, token.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(await validateApiToken(rawToken)).not.toBeNull();
    });

    it("revokeAllUserTokens revokes every active token of that user only", async () => {
      const a1 = await createApiToken(userA, readInput);
      const a2 = await createApiToken(userA, readInput);
      const b1 = await createApiToken(userB, readInput);

      await revokeAllUserTokens(userA, "admin-disable");

      expect(await validateApiToken(a1.rawToken)).toBeNull();
      expect(await validateApiToken(a2.rawToken)).toBeNull();
      expect(await validateApiToken(b1.rawToken)).not.toBeNull();
      const reasons = await pool.query("SELECT DISTINCT revoke_reason FROM api_tokens WHERE user_id = $1", [userA]);
      expect(reasons.rows).toEqual([{ revoke_reason: "admin-disable" }]);
    });

    it("deleteExpiredApiTokens removes only rows dead for over 30 days", async () => {
      const old = await createApiToken(userA, readInput);
      const recent = await createApiToken(userA, readInput);
      await pool.query("UPDATE api_tokens SET revoked_at = NOW() - INTERVAL '31 days' WHERE id = $1", [old.token.id]);
      await pool.query("UPDATE api_tokens SET revoked_at = NOW() - INTERVAL '1 day' WHERE id = $1", [recent.token.id]);

      await deleteExpiredApiTokens();

      const ids = (await pool.query("SELECT id FROM api_tokens WHERE user_id = $1", [userA])).rows.map((r) => r.id);
      expect(ids).toEqual([recent.token.id]);
    });
  });
});
