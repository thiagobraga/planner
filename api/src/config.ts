import { readFileSync } from "node:fs";

const TEST_FALLBACK_URL = "postgres://planner:planner@localhost:5432/planner_test";

function readSecret(name: string, fallback?: string): string {
  const filePath = process.env[`${name}_FILE`];
  if (filePath) {
    try {
      return readFileSync(filePath, "utf8").replace(/\n$/, "");
    } catch (err) {
      throw new Error(
        `Cannot read secret file ${filePath} for ${name}: ${(err as Error).message}`,
      );
    }
  }

  const val = process.env[name];
  if (val) return val;

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(
    `Missing required environment variable: ${name} (or ${name}_FILE)`,
  );
}

function requireNonPlaceholder(value: string, name: string): void {
  const placeholders = ["change-me", "changeme", "placeholder"];
  const lower = value.toLowerCase();
  for (const p of placeholders) {
    if (lower.includes(p)) {
      throw new Error(
        `Rejected placeholder-like value for ${name}: value contains "${p}"`,
      );
    }
  }
}

function validateProductionMode(): void {
  const nodeEnv = process.env.NODE_ENV || "development";
  if (!["production", "development", "test"].includes(nodeEnv)) {
    throw new Error(
      `NODE_ENV must be one of: production, development, test (got: ${nodeEnv})`,
    );
  }
}

validateProductionMode();

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";

export const DATABASE_URL = (() => {
  const fallback = NODE_ENV === "test" ? TEST_FALLBACK_URL : undefined;
  const url = readSecret("DATABASE_URL", fallback);
  if (IS_PRODUCTION) {
    requireNonPlaceholder(url, "DATABASE_URL");
    if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
      throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
    }
  }
  return url;
})();

export const REDIS_URL = (() => {
  const url = readSecret("REDIS_URL", "redis://localhost:6379");
  if (IS_PRODUCTION) {
    requireNonPlaceholder(url, "REDIS_URL");
    if (!url.startsWith("redis://") && !url.startsWith("rediss://")) {
      throw new Error("REDIS_URL must start with redis:// or rediss://");
    }
  }
  return url;
})();

export const CSRF_SECRET = (() => {
  const fallback = IS_PRODUCTION ? undefined : "a".repeat(32);
  const secret = readSecret("CSRF_SECRET", fallback);
  if (IS_PRODUCTION) {
    requireNonPlaceholder(secret, "CSRF_SECRET");
    if (secret.length < 32) {
      throw new Error("CSRF_SECRET must be at least 32 characters long");
    }
  }
  return secret;
})();

export const CORS_ORIGIN = (() => {
  const origin = readSecret("CORS_ORIGIN", "http://localhost:5173");
  if (IS_PRODUCTION) {
    requireNonPlaceholder(origin, "CORS_ORIGIN");
    try {
      new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN is not a valid URL: ${origin}`);
    }
  }
  return origin;
})();

export const PORT = process.env.PORT || "4000";

export const SESSION_IDLE_TTL_MINUTES = (() => {
  const raw = process.env.SESSION_IDLE_TTL_MINUTES || "30";
  const val = parseInt(raw, 10);
  if (isNaN(val) || val < 1) {
    throw new Error("SESSION_IDLE_TTL_MINUTES must be a positive integer");
  }
  return val;
})();

export const SESSION_ABSOLUTE_TTL_HOURS = (() => {
  const raw = process.env.SESSION_ABSOLUTE_TTL_HOURS || "12";
  const val = parseInt(raw, 10);
  if (isNaN(val) || val < 1) {
    throw new Error("SESSION_ABSOLUTE_TTL_HOURS must be a positive integer");
  }
  return val;
})();

export const DISABLE_RATE_LIMITS_IN_DEV = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

// Empty means "no provider configured": emailService falls back to logging
// reset links to the console so the flow is testable without credentials.
export const RESEND_API_KEY = readSecret("RESEND_API_KEY", "");

export const EMAIL_FROM = readSecret("EMAIL_FROM", "noreply@planner.thiagobraga.dev");

if (IS_PRODUCTION && !RESEND_API_KEY) {
  console.warn(
    "⚠️  RESEND_API_KEY is not set - password reset emails will not be delivered",
  );
}
