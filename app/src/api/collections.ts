import { request } from './transport';
import type { ApiCollection, ApiSection, ApiStatus, CollectionView } from '../types/api';

// Collections ----------------------------------------------------------------

// Collection colors intentionally stay soft and muted so they sit on top of
// the paper surface instead of competing with the page chrome.
export const PALETTE_COLORS: readonly string[] = [
  '#d56b64',
  '#c98079',
  '#b97a3a',
  '#cbd376',
  '#b7bf4e',
  '#d7db96',
  '#7dbfb2',
  '#a6cfc5',
  '#7ea2d6',
  '#6fa0d5',
  '#adb9c1',
  '#65788a',
  '#b08b8a',
  '#c2a29e',
  '#d6c7b0',
  '#d16d73',
  '#cc8b85',
  '#6f7780',
  '#bababa',
  '#ac918f',
];

export async function fetchCollections(): Promise<ApiCollection[]> {
  return request('/collections');
}

export async function apiCreateCollection(input: {
  name: string;
  color: string;
  parentId?: string | null;
}): Promise<ApiCollection> {
  return request<ApiCollection>('/collections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateCollection(
  id: string,
  updates: Partial<Pick<ApiCollection, 'name' | 'color' | 'parentId' | 'orderValue'>>,
): Promise<ApiCollection> {
  return request<ApiCollection>(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteCollection(id: string): Promise<void> {
  await request<unknown>(`/collections/${id}`, { method: 'DELETE' });
}

export async function fetchSavedColors(): Promise<string[]> {
  return request<string[]>('/saved-colors');
}

export async function apiAddSavedColor(color: string): Promise<string[]> {
  return request<string[]>('/saved-colors', {
    method: 'POST',
    body: JSON.stringify({ color }),
  });
}

export async function apiArchiveCollection(id: string): Promise<ApiCollection> {
  return request<ApiCollection>(`/collections/${id}/archive`, { method: 'POST' });
}

export async function fetchCollectionView(id: string): Promise<CollectionView> {
  return request<CollectionView>(`/views/collection/${id}`);
}

// Statuses ------------------------------------------------------------------

export async function fetchStatuses(collectionId: string): Promise<ApiStatus[]> {
  return request<ApiStatus[]>(`/collections/${collectionId}/statuses`);
}

export async function apiSeedStatuses(collectionId: string): Promise<ApiStatus[]> {
  return request<ApiStatus[]>(`/collections/${collectionId}/statuses/seed`, { method: 'POST' });
}

export async function apiCreateStatus(
  collectionId: string,
  input: { name: string; color?: string },
): Promise<ApiStatus> {
  return request<ApiStatus>(`/collections/${collectionId}/statuses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateStatus(
  statusId: string,
  input: Partial<{ name: string; color: string; position: number; nextStatusMode: ApiStatus['nextStatusMode']; nextStatusId: string | null; acceptStatusId: string | null; rejectStatusId: string | null }>,
): Promise<ApiStatus> {
  return request<ApiStatus>(`/statuses/${statusId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function apiSetCollectionCompletionStatus(
  collectionId: string,
  statusId: string,
): Promise<{ completionStatusId: string }> {
  return request<{ completionStatusId: string }>(`/collections/${collectionId}/completion-status`, {
    method: 'PATCH',
    body: JSON.stringify({ statusId }),
  });
}

export async function apiDeleteStatus(statusId: string, reassignToStatusId?: string): Promise<void> {
  const search = reassignToStatusId ? `?reassignTo=${encodeURIComponent(reassignToStatusId)}` : '';
  await request<unknown>(`/statuses/${statusId}${search}`, { method: 'DELETE' });
}

// Sections ------------------------------------------------------------------

export async function fetchSections(collectionId: string): Promise<ApiSection[]> {
  return request<ApiSection[]>(`/collections/${collectionId}/sections`);
}

export async function apiCreateSection(collectionId: string, input: { name: string }): Promise<ApiSection> {
  return request<ApiSection>(`/collections/${collectionId}/sections`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateSection(
  sectionId: string,
  updates: Partial<{ name: string; position: number }>,
): Promise<ApiSection> {
  return request<ApiSection>(`/sections/${sectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteSection(sectionId: string): Promise<void> {
  await request<unknown>(`/sections/${sectionId}`, { method: 'DELETE' });
}
