import type { UserRole } from "./auth.js";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  disabledAt: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
}

export interface ListUsersResult {
  users: AdminUser[];
  nextCursor: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: Date;
  disabled_at: Date | null;
  last_seen_at: Date | null;
  active_sessions: string;
}

export interface AdminCounts {
  users: number;
  activeUsers: number;
  disabledUsers: number;
  admins: number;
  tasks: number;
  completedTasks: number;
  collections: number;
  habits: number;
}

export interface AdminHealth {
  database: {
    status: "up" | "down";
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
  redis: { status: "up" | "down" };
  process: {
    uptimeSeconds: number;
    memoryRssBytes: number;
    nodeVersion: string;
  };
}

export interface AdminAuthStats {
  activeSessions: number;
  sessionsLastDay: number;
  usersOnlineLastHour: number;
  throttledAccounts: number;
  throttledIps: number;
  failedLoginAttempts: number;
}
