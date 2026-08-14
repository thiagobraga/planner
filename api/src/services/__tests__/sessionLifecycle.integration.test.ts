import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import pool from "../../db/pool.js";
import {
  createSession,
  validateSession,
  touchSession,
  revokeSession,
  revokeAllUserSessions,
  deleteExpiredSessions,
  findValidSessionByUserId,
  generateRawToken,
  hashToken,
} from "../sessionService.js";
import crypto from "node:crypto";

const createdUserIds: string[] = [];

async function createTestUser(emailSuffix: string): Promise<string> {
  const userId = crypto.randomUUID();
  const email = `test-${emailSuffix}-${Date.now()}-${Math.random()}@example.com`;
  await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
    [userId, email, "hashed-pass"],
  );
  createdUserIds.push(userId);
  return userId;
}

describe("sessionLifecycle integration tests (real PostgreSQL)", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    userA = await createTestUser("usera");
    userB = await createTestUser("userb");
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM sessions WHERE user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query(
        "DELETE FROM users WHERE id = ANY($1::uuid[])",
        [createdUserIds],
      );
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    // Ensure pool connections don't hang vitest exit
  });

  it("completes full session lifecycle: create -> validate -> touch -> revoke -> validate", async () => {
    const rawToken = await createSession(userA);
    expect(rawToken).toBeDefined();

    const ctx = await validateSession(rawToken);
    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe(userA);

    if (ctx) {
      await touchSession(ctx.sessionId);
    }

    const ctxAfterTouch = await validateSession(rawToken);
    expect(ctxAfterTouch).not.toBeNull();

    if (ctx) {
      await revokeSession(ctx.sessionId);
    }

    const ctxAfterRevoke = await validateSession(rawToken);
    expect(ctxAfterRevoke).toBeNull();
  });

  it("handles multiple active sessions for user and selective revocation", async () => {
    const token1 = await createSession(userA);
    const token2 = await createSession(userA);
    const tokenB = await createSession(userB);

    const ctx1 = await validateSession(token1);
    const ctx2 = await validateSession(token2);
    const ctxB = await validateSession(tokenB);

    expect(ctx1?.userId).toBe(userA);
    expect(ctx2?.userId).toBe(userA);
    expect(ctxB?.userId).toBe(userB);

    // Revoke token 1 of user A
    await revokeSession(ctx1!.sessionId);

    expect(await validateSession(token1)).toBeNull();
    expect(await validateSession(token2)).not.toBeNull();
    expect(await validateSession(tokenB)).not.toBeNull();

    // Revoke all sessions for User A
    await revokeAllUserSessions(userA, "password-change");

    expect(await validateSession(token2)).toBeNull();
    expect(await validateSession(tokenB)).not.toBeNull();
  });

  it("rejects expired idle and absolute sessions", async () => {
    const rawIdleToken = generateRawToken();
    const idleHash = hashToken(rawIdleToken);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash_sha256, idle_expires_at, absolute_expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 minute', NOW() + INTERVAL '1 hour')`,
      [userA, idleHash],
    );

    const rawAbsToken = generateRawToken();
    const absHash = hashToken(rawAbsToken);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash_sha256, idle_expires_at, absolute_expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW() - INTERVAL '1 minute')`,
      [userA, absHash],
    );

    expect(await validateSession(rawIdleToken)).toBeNull();
    expect(await validateSession(rawAbsToken)).toBeNull();
  });

  it("finds valid session by user ID and deletes expired sessions", async () => {
    const activeToken = await createSession(userA);
    const ctx = await validateSession(activeToken);

    const foundId = await findValidSessionByUserId(userA);
    expect(foundId).toBe(ctx?.sessionId);

    // Insert an expired session
    const expiredToken = generateRawToken();
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash_sha256, idle_expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '10 minutes')`,
      [userA, hashToken(expiredToken)],
    );

    const count = await deleteExpiredSessions();
    expect(count).toBeGreaterThanOrEqual(1);

    // Active session should still be valid after deleting expired sessions
    expect(await validateSession(activeToken)).not.toBeNull();
  });
});
