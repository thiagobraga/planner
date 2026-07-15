function env(name: string, fallback?: string): string {
  const val = process.env[name];
  if (val) return val;
  if (fallback !== undefined && process.env.NODE_ENV === 'test') return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const JWT_SECRET = env('JWT_SECRET', 'test-secret-not-for-prod');
export const DATABASE_URL = env('DATABASE_URL', 'postgres://planner:planner@localhost:5432/planner');
export const CORS_ORIGIN = env('CORS_ORIGIN', 'http://localhost:5173');
export const PORT = process.env.PORT || '4000';
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
