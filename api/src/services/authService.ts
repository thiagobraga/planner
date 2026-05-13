import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../db/pool.js";
import { redisClient } from "../db/redis.js";
import { AppError } from "../utils/AppError.js";
import { validate, type ValidationError } from "../utils/validate.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const BCRYPT_COST = 12;
const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds

// RFC 5322 simplified email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

interface AuthResult {
  user: { id: string; email: string; displayName: string };
  token: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const errors: ValidationError[] = [];

  if (!input.email || !EMAIL_REGEX.test(input.email)) {
    errors.push({ field: "email", message: "Email must be a valid RFC 5322 address" });
  }

  if (!input.password || input.password.length < 8) {
    errors.push({ field: "password", message: "Password must be at least 8 characters" });
  }

  if (
    !input.displayName ||
    input.displayName.length < 1 ||
    input.displayName.length > 50
  ) {
    errors.push({ field: "displayName", message: "Display name must be 1 to 50 characters" });
  }

  validate(errors);

  // Check duplicate email
  const existing = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
    [input.email]
  );

  if (existing.rows.length > 0) {
    throw new AppError({
      code: "EMAIL_IN_USE",
      message: "An account with this email already exists",
      statusCode: 409,
    });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const userId = uuidv4();
  const projectId = uuidv4();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, input.email, passwordHash, input.displayName]
    );

    await client.query(
      `INSERT INTO projects (id, user_id, name, color, is_inbox)
       VALUES ($1, $2, 'Inbox', 'grey', true)`,
      [projectId, userId]
    );

    await client.query(
      `INSERT INTO preferences (user_id) VALUES ($1)`,
      [userId]
    );

    await client.query(
      `INSERT INTO karma_stats (user_id) VALUES ($1)`,
      [userId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const token = jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION_SECONDS }
  );

  return {
    user: { id: userId, email: input.email, displayName: input.displayName },
    token,
  };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  // Check rate limit
  const rateLimitKey = `login_attempts:${email.toLowerCase()}`;
  const attempts = await redisClient.get(rateLimitKey);

  if (attempts && parseInt(attempts, 10) > LOGIN_RATE_LIMIT_MAX) {
    throw new AppError({
      code: "RATE_LIMITED",
      message: "Too many failed login attempts. Please try again later.",
      statusCode: 429,
    });
  }

  // Look up user
  const result = await pool.query(
    "SELECT id, email, password_hash, display_name FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    await incrementFailedAttempts(rateLimitKey);
    throw new AppError({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
      statusCode: 401,
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    await incrementFailedAttempts(rateLimitKey);
    throw new AppError({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
      statusCode: 401,
    });
  }

  await redisClient.del(rateLimitKey);

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [sessionId, user.id, sessionId, expiresAt]
  );

  const token = jwt.sign(
    { userId: user.id, sessionId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION_SECONDS }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
    token,
  };
}

async function incrementFailedAttempts(key: string): Promise<void> {
  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.expire(key, LOGIN_RATE_LIMIT_WINDOW);
  }
}

const PASSWORD_RESET_EXPIRY_MINUTES = 60;

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const message = "If an account exists, a reset email has been sent";

  const result = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  if (result.rows.length === 0) {
    return { message };
  }

  const userId = result.rows[0].id;
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  // Stub: log instead of sending email
  console.log(`[PASSWORD RESET] Token for ${email}: ${rawToken}`);

  return { message };
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ success: true }> {
  const errors: ValidationError[] = [];
  if (!newPassword || newPassword.length < 8) {
    errors.push({ field: "newPassword", message: "Password must be at least 8 characters" });
  }
  validate(errors);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const result = await pool.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "TOKEN_INVALID",
      message: "Token is invalid or has expired",
      statusCode: 400,
    });
  }

  const row = result.rows[0];

  if (row.used_at || new Date(row.expires_at) < new Date()) {
    throw new AppError({
      code: "TOKEN_INVALID",
      message: "Token is invalid or has expired",
      statusCode: 400,
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, row.user_id]
    );

    await client.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
      [row.id]
    );

    await client.query(
      "DELETE FROM sessions WHERE user_id = $1",
      [row.user_id]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}
