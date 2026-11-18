import { request } from './transport';
import type { AdminAuthStats, AdminCounts, AdminHealth, AdminUser, AdminUserList } from '../types/api';

// Admin --------------------------------------------------------------------

export async function apiListUsers(params: {
  search?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<AdminUserList> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString();
  return request<AdminUserList>(`/admin/users${suffix ? `?${suffix}` : ''}`);
}

export async function apiDisableUser(id: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/disable`, { method: 'POST' });
}

export async function apiEnableUser(id: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/enable`, { method: 'POST' });
}

export async function apiRevokeSessions(id: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/revoke-sessions`, { method: 'POST' });
}

export async function apiGetAdminCounts(): Promise<AdminCounts> {
  return request<AdminCounts>('/admin/stats/counts');
}

export async function apiGetAdminHealth(): Promise<AdminHealth> {
  return request<AdminHealth>('/admin/stats/health');
}

export async function apiGetAdminAuthStats(): Promise<AdminAuthStats> {
  return request<AdminAuthStats>('/admin/stats/auth');
}
