import { request } from './transport';
import type { AuthUser } from '../types/api';
import type { AccountExportData } from '../types/account';

// Auth ---------------------------------------------------------------------

export async function apiRegister(
  email: string,
  password: string,
  displayName?: string,
  timeZone?: string,
): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      ...(displayName ? { displayName } : {}),
      ...(timeZone ? { timeZone } : {}),
    }),
  });
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

export async function apiRequestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiConfirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/auth/reset-password/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
// Account data export & deletion -------------------------------------------

export async function apiExportAccountData(): Promise<AccountExportData> {
  return request<AccountExportData>('/account/export');
}

export async function apiDeleteAccount(): Promise<void> {
  await request<{ success: boolean }>('/account', { method: 'DELETE' });
}
