import crypto from "node:crypto";
import { redisClient } from "../db/redis.js";
import { securityLog } from "../utils/securityLogger.js";
import { IS_PRODUCTION, DISABLE_RATE_LIMITS_IN_DEV } from "../config.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const LOGIN_ACCOUNT_MAX = 10;
const LOGIN_ACCOUNT_WINDOW = 15 * 60;

const LOGIN_IP_MAX = 20;
const LOGIN_IP_WINDOW = 15 * 60;

const REGISTER_IP_MAX = 3;
const REGISTER_IP_WINDOW = 60 * 60;

const RESET_IP_MAX = 5;
const RESET_IP_WINDOW = 60 * 60;

const DELAY_THRESHOLD = 5;
const LOCKOUT_THRESHOLD = LOGIN_ACCOUNT_MAX;

let memFallbackActive = false;

interface MemEntry {
  count: number;
  expiresAt: number;
}

const memStore = new Map<string, MemEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expiresAt <= now) {
      memStore.delete(key);
    }
  }
}, 60_000);

function incrementMem(key: string, windowSeconds: number): number {
  const now = Date.now();
  const existing = memStore.get(key);
  if (existing && existing.expiresAt > now) {
    existing.count++;
    return existing.count;
  }
  memStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
  return 1;
}

function getMemCount(key: string): number {
  const now = Date.now();
  const existing = memStore.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.count;
  }
  return 0;
}

export async function checkLoginRate(
  email: string,
  ip: string,
): Promise<RateLimitResult> {
  if (DISABLE_RATE_LIMITS_IN_DEV) {
    return { allowed: true, remaining: LOGIN_ACCOUNT_MAX, retryAfterSeconds: 0 };
  }

  const emailHash = crypto.createHash("sha256").update(email.toLowerCase().normalize("NFC")).digest("hex");
  const accountKey = `rl:acct:${emailHash}`;
  const ipKey = `rl:login:ip:${ip}`;

  const [accountCount, ipCount] = await getCounts(accountKey, ipKey, LOGIN_ACCOUNT_WINDOW);

  const maxAccount = Math.max(accountCount, ipCount > 0 ? ipCount : 0);
  const effectiveCount = Math.max(accountCount, ipCount);

  if (effectiveCount >= LOCKOUT_THRESHOLD || accountCount >= LOCKOUT_THRESHOLD || ipCount >= LOGIN_IP_MAX) {
    const maxRemaining = Math.min(
      Math.max(0, LOGIN_ACCOUNT_MAX - accountCount),
      Math.max(0, LOGIN_IP_MAX - ipCount),
    );
    return { allowed: false, remaining: maxRemaining, retryAfterSeconds: LOGIN_ACCOUNT_WINDOW };
  }

  const remaining = Math.min(
    Math.max(0, LOGIN_ACCOUNT_MAX - accountCount),
    Math.max(0, LOGIN_IP_MAX - ipCount),
  );

  return { allowed: true, remaining, retryAfterSeconds: 0 };
}

async function getCounts(
  accountKey: string,
  ipKey: string,
  windowSeconds: number,
): Promise<[number, number]> {
  if (redisClient.isReady) {
    try {
      const [accountCount, ipCount] = await Promise.all([
        redisClient.get(accountKey).then((v) => (v ? parseInt(v, 10) : 0)),
        redisClient.get(ipKey).then((v) => (v ? parseInt(v, 10) : 0)),
      ]);
      return [accountCount, ipCount];
    } catch {
      if (IS_PRODUCTION) {
        console.warn("⚠️  Redis unavailable, falling back to in-memory rate limiting");
        memFallbackActive = true;
        securityLog.rateLimitActivated({} as never, "redis-fallback-mem", 0);
      }
    }
  }

  if (IS_PRODUCTION && !memFallbackActive) {
    console.warn("⚠️  Redis not ready, falling back to in-memory rate limiting");
    memFallbackActive = true;
    securityLog.rateLimitActivated({} as never, "redis-not-ready-fallback-mem", 0);
  }

  return [getMemCount(accountKey), getMemCount(ipKey)];
}

export async function incrementLoginAttempts(email: string, ip: string): Promise<void> {
  if (DISABLE_RATE_LIMITS_IN_DEV) return;

  const emailHash = crypto.createHash("sha256").update(email.toLowerCase().normalize("NFC")).digest("hex");
  const accountKey = `rl:acct:${emailHash}`;
  const ipKey = `rl:login:ip:${ip}`;

  await Promise.all([
    incrementKey(accountKey, LOGIN_ACCOUNT_WINDOW),
    incrementKey(ipKey, LOGIN_IP_WINDOW),
  ]);
}

export async function clearLoginRate(email: string, ip: string): Promise<void> {
  if (DISABLE_RATE_LIMITS_IN_DEV) return;

  const emailHash = crypto.createHash("sha256").update(email.toLowerCase().normalize("NFC")).digest("hex");
  const accountKey = `rl:acct:${emailHash}`;
  const ipKey = `rl:login:ip:${ip}`;

  await Promise.all([
    redisClient.isReady ? redisClient.del(accountKey).catch(() => {}) : Promise.resolve(),
    redisClient.isReady ? redisClient.del(ipKey).catch(() => {}) : Promise.resolve(),
  ]);

  memStore.delete(accountKey);
  memStore.delete(ipKey);
}

async function incrementKey(key: string, windowSeconds: number): Promise<void> {
  if (redisClient.isReady) {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      return;
    } catch {
      if (IS_PRODUCTION) {
        console.warn("⚠️  Redis unavailable, using in-memory fallback");
      }
    }
  }

  incrementMem(key, windowSeconds);
}

export function getProgressiveDelay(attempts: number): number {
  if (attempts >= LOCKOUT_THRESHOLD) return 0;
  if (attempts >= 8) return 2000;
  if (attempts >= DELAY_THRESHOLD) return 1000;
  return 0;
}

export async function checkRegistrationRate(ip: string): Promise<RateLimitResult> {
  if (DISABLE_RATE_LIMITS_IN_DEV) {
    return { allowed: true, remaining: REGISTER_IP_MAX, retryAfterSeconds: 0 };
  }

  const ipKey = `rl:reg:ip:${ip}`;
  const count = redisClient.isReady
    ? await redisClient.get(ipKey).then((v) => (v ? parseInt(v, 10) : 0)).catch(() => getMemCount(ipKey))
    : getMemCount(ipKey);

  const remaining = Math.max(0, REGISTER_IP_MAX - count);
  return {
    allowed: count < REGISTER_IP_MAX,
    remaining,
    retryAfterSeconds: count >= REGISTER_IP_MAX ? REGISTER_IP_WINDOW : 0,
  };
}

export async function incrementRegistrationAttempts(ip: string): Promise<void> {
  if (DISABLE_RATE_LIMITS_IN_DEV) return;
  await incrementKey(`rl:reg:ip:${ip}`, REGISTER_IP_WINDOW);
}

export async function checkPasswordResetRate(ip: string): Promise<RateLimitResult> {
  if (DISABLE_RATE_LIMITS_IN_DEV) {
    return { allowed: true, remaining: RESET_IP_MAX, retryAfterSeconds: 0 };
  }

  const ipKey = `rl:reset:ip:${ip}`;
  const count = redisClient.isReady
    ? await redisClient.get(ipKey).then((v) => (v ? parseInt(v, 10) : 0)).catch(() => getMemCount(ipKey))
    : getMemCount(ipKey);

  const remaining = Math.max(0, RESET_IP_MAX - count);
  return {
    allowed: count < RESET_IP_MAX,
    remaining,
    retryAfterSeconds: count >= RESET_IP_MAX ? RESET_IP_WINDOW : 0,
  };
}

export async function incrementPasswordResetAttempts(ip: string): Promise<void> {
  if (DISABLE_RATE_LIMITS_IN_DEV) return;
  await incrementKey(`rl:reset:ip:${ip}`, RESET_IP_WINDOW);
}

export function isMemFallbackActive(): boolean {
  return memFallbackActive;
}

export function resetMemFallbackFlag(): void {
  memFallbackActive = false;
}
