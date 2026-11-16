import { request } from './transport';
import type { ApiToken, CreateApiTokenInput, CreatedApiToken } from '../types/apiToken';
import type { ActivityPage, ActivityQuery } from '../types/activity';
import type { ConnectedApp, ConsentDecision, PendingAuthorization } from '../types/oauth';

// API tokens ----------------------------------------------------------------

export async function fetchApiTokens(): Promise<ApiToken[]> {
  return request<ApiToken[]>('/api-tokens');
}

export async function apiCreateApiToken(input: CreateApiTokenInput): Promise<CreatedApiToken> {
  return request<CreatedApiToken>('/api-tokens', { method: 'POST', body: JSON.stringify(input) });
}

export async function apiRevokeApiToken(id: string): Promise<void> {
  await request<unknown>(`/api-tokens/${id}`, { method: 'DELETE' });
}

// OAuth (connected apps) ----------------------------------------------------

export async function fetchOAuthRequest(id: string): Promise<PendingAuthorization> {
  return request<PendingAuthorization>(`/oauth/requests/${encodeURIComponent(id)}`);
}

export async function apiDecideOAuthRequest(id: string, decision: ConsentDecision): Promise<{ redirectUrl: string }> {
  return request<{ redirectUrl: string }>(`/oauth/requests/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export async function fetchConnectedApps(): Promise<ConnectedApp[]> {
  return request<ConnectedApp[]>('/oauth/grants');
}

export async function apiDisconnectApp(id: string): Promise<void> {
  await request<unknown>(`/oauth/grants/${id}`, { method: 'DELETE' });
}

// Activity ------------------------------------------------------------------

export async function fetchActivity(query: ActivityQuery = {}): Promise<ActivityPage> {
  const params = new URLSearchParams();
  if (query.tokenId) params.set('token_id', query.tokenId);
  if (query.source) params.set('source', query.source);
  if (query.cursor) params.set('cursor', query.cursor);
  const qs = params.toString();
  return request<ActivityPage>(`/activity${qs ? `?${qs}` : ''}`);
}
