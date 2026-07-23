import crypto from 'node:crypto';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { validate, type ValidationError } from '../utils/validate.js';
import { securityLog } from '../utils/securityLogger.js';
import { validatePassword, hashPassword, verifyArgon2id } from './passwordService.js';
import { createSession } from './sessionService.js';
import { sendPasswordResetEmail } from './emailService.js';
import { CORS_ORIGIN } from '../config.js';
import {
  checkLoginRate,
  incrementLoginAttempts,
  clearLoginRate,
  getProgressiveDelay,
} from './rateLimitService.js';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export interface UserData {
  id: string;
  email: string;
  displayName: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export async function register(input: RegisterInput): Promise<UserData> {
  const errors: ValidationError[] = [];

  if (!input.email || !EMAIL_REGEX.test(input.email)) {
    errors.push({ field: 'email', message: 'Email must be a valid RFC 5322 address' });
  }

  let validatedPassword = '';

  if (!input.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else {
    try {
      validatedPassword = validatePassword(input.password);
    } catch {
      errors.push({ field: 'password', message: 'Password does not meet strength requirements' });
    }
  }

  if (input.displayName !== undefined && input.displayName !== null) {
    if (input.displayName.length < 1 || input.displayName.length > 50) {
      errors.push({ field: 'displayName', message: 'Display name must be 1 to 50 characters' });
    }
  }

  validate(errors);

  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [
    input.email,
  ]);

  if (existing.rows.length > 0) {
    throw new AppError({
      code: 'EMAIL_IN_USE',
      message: 'An account with this email already exists',
      statusCode: 409,
    });
  }

  const passwordHash = await hashPassword(validatedPassword);
  const userId = crypto.randomUUID();
  const collectionId = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, input.email, passwordHash, input.displayName ?? null],
    );

    await client.query(
      `INSERT INTO collections (id, user_id, name, color, is_inbox)
       VALUES ($1, $2, 'Inbox', 'grey', true)`,
      [collectionId, userId],
    );

    await client.query(`INSERT INTO preferences (user_id) VALUES ($1)`, [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { id: userId, email: input.email, displayName: input.displayName ?? null };
}

export async function login(email: string, password: string, ip?: string): Promise<{ user: UserData; rawToken: string }> {
  const clientIp = ip ?? 'unknown';

  const rateResult = await checkLoginRate(email, clientIp);

  if (!rateResult.allowed) {
    throw new AppError({
      code: 'RATE_LIMITED',
      message: 'Too many failed login attempts. Please try again later.',
      statusCode: 429,
    });
  }

  const result = await pool.query(
    'SELECT id, email, password_hash, display_name FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );

  const user = result.rows[0];

  if (!user) {
    await incrementLoginAttempts(email, clientIp);
    throw new AppError({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
      statusCode: 401,
    });
  }

  const valid = await verifyArgon2id(user.password_hash, password);

  if (!valid) {
    await incrementLoginAttempts(email, clientIp);
    throw new AppError({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
      statusCode: 401,
    });
  }

  await clearLoginRate(email, clientIp);

  const rawToken = await createSession(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
    rawToken,
  };
}

const PASSWORD_RESET_EXPIRY_MINUTES = 60;

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const message = 'If an account exists, a reset email has been sent';

  const result = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);

  if (result.rows.length === 0) {
    return { message };
  }

  const userId = result.rows[0].id;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  await sendPasswordResetEmail(email, `${CORS_ORIGIN}/reset-password?token=${rawToken}`);

  return { message };
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: true }> {
  const errors: ValidationError[] = [];
  if (!newPassword) {
    errors.push({ field: 'newPassword', message: 'Password is required' });
  }
  validate(errors);

  const validatedPassword = newPassword ? validatePassword(newPassword) : '';

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await pool.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: 'TOKEN_INVALID',
      message: 'Token is invalid or has expired',
      statusCode: 400,
    });
  }

  const row = result.rows[0];

  if (row.used_at || new Date(row.expires_at) < new Date()) {
    throw new AppError({
      code: 'TOKEN_INVALID',
      message: 'Token is invalid or has expired',
      statusCode: 400,
    });
  }

  const passwordHash = await hashPassword(validatedPassword);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      row.user_id,
    ]);

    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    await client.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);
    securityLog.sessionRevoked(row.user_id, 'password-reset');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  securityLog.passwordChanged(row.user_id);
  return { success: true };
}
