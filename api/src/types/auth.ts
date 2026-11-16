export type UserRole = 'user' | 'admin';

export interface UserData {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
  timeZone?: string;
}

export interface SessionContext {
  userId: string;
  sessionId: number;
  /** Null only on rows written before migration 027 added the column. */
  lastSeenAt: Date | null;
}

export interface SessionRow {
  id: number;
  user_id: string;
  last_seen_at: Date | null;
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}
