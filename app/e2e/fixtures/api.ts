import { expect, test as base, type APIRequestContext, type APIResponse } from '@playwright/test';
import path from 'node:path';

import type {
  ApiCollection,
  ApiStatus,
  ApiTask,
  CollectionView,
  TaskMoveInput,
  TaskMoveResponse,
} from '../../src/api/client';

export { expect };

export const BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://planner.local';

export const API_URL =
  process.env.E2E_API_URL ?? process.env.PLAYWRIGHT_API_URL ?? `${new URL(BASE_URL).origin}/api/v1`;

export const API_ORIGIN = new URL(API_URL).origin;
export const API_PATH = new URL(API_URL).pathname.replace(/\/$/, '') || '/api/v1';

export const STORAGE_STATE_PATH = path.resolve(import.meta.dirname, '../storageState.json');

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface AuthedApi {
  request: APIRequestContext;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, data?: JsonValue): Promise<T>;
  patch<T>(path: string, data?: JsonValue): Promise<T>;
  delete<T>(path: string, data?: JsonValue): Promise<T>;
  fetchCollectionView(collectionId: string): Promise<CollectionView>;
  fetchStatuses(collectionId: string): Promise<ApiStatus[]>;
  createCollection(input: { name: string; color: string; parentId?: string | null }): Promise<ApiCollection>;
  deleteCollection(collectionId: string): Promise<void>;
  seedStatuses(collectionId: string): Promise<ApiStatus[]>;
  createStatus(collectionId: string, input: { name: string; color?: string }): Promise<ApiStatus>;
  updateStatus(
    statusId: string,
    input: Partial<{ name: string; color: string; position: number }>,
  ): Promise<ApiStatus>;
  deleteStatus(statusId: string, reassignToStatusId?: string): Promise<void>;
  createTask(input: {
    title: string;
    collectionId?: string;
    sectionId?: string;
    parentTaskId?: string;
    dueDate?: string;
    priority?: number;
    orderValue?: number;
  }): Promise<ApiTask>;
  moveTask(taskId: string, input: TaskMoveInput): Promise<TaskMoveResponse>;
}

async function readJson<T>(response: APIResponse): Promise<T> {
  if (response.status() < 200 || response.status() >= 300) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status()} ${response.url()} -> ${body || response.statusText()}`);
  }
  return response.json() as Promise<T>;
}

function isCsrfCookie(name: string): boolean {
  return name.endsWith('_csrf');
}

async function ensureCsrfToken(request: APIRequestContext): Promise<string> {
  await request.get(`${API_PATH}/collections`, { failOnStatusCode: false });
  const state = await request.storageState();
  const csrfCookie = state.cookies.find((cookie) => isCsrfCookie(cookie.name));
  if (!csrfCookie) {
    throw new Error('Missing CSRF cookie after priming the authenticated API context');
  }
  const token = decodeURIComponent(csrfCookie.value).split(':', 1)[0];
  if (!token) {
    throw new Error('Malformed CSRF cookie');
  }
  return token;
}

async function sendJson<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: JsonValue,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-XSRF-TOKEN'] = await ensureCsrfToken(request);
  }

  const response = await request.fetch(`${API_PATH}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    data,
    headers,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  return readJson<T>(response);
}

function createApi(request: APIRequestContext): AuthedApi {
  return {
    request,
    get: async <T>(path: string) => sendJson<T>(request, 'GET', path),
    post: async <T>(path: string, data?: JsonValue) => sendJson<T>(request, 'POST', path, data),
    patch: async <T>(path: string, data?: JsonValue) => sendJson<T>(request, 'PATCH', path, data),
    delete: async <T>(path: string, data?: JsonValue) => sendJson<T>(request, 'DELETE', path, data),
    fetchCollectionView: async (collectionId: string) =>
      sendJson<CollectionView>(request, 'GET', `/views/collection/${collectionId}`),
    fetchStatuses: async (collectionId: string) =>
      sendJson<ApiStatus[]>(request, 'GET', `/collections/${collectionId}/statuses`),
    createCollection: async (input) => sendJson<ApiCollection>(request, 'POST', '/collections', input),
    deleteCollection: async (collectionId: string) =>
      sendJson<void>(request, 'DELETE', `/collections/${collectionId}`),
    seedStatuses: async (collectionId: string) =>
      sendJson<ApiStatus[]>(request, 'POST', `/collections/${collectionId}/statuses/seed`),
    createStatus: async (collectionId: string, input) =>
      sendJson<ApiStatus>(request, 'POST', `/collections/${collectionId}/statuses`, input),
    updateStatus: async (statusId: string, input) =>
      sendJson<ApiStatus>(request, 'PATCH', `/statuses/${statusId}`, input),
    deleteStatus: async (statusId: string, reassignToStatusId?: string) => {
      const query = reassignToStatusId ? `?reassignTo=${encodeURIComponent(reassignToStatusId)}` : '';
      await sendJson<void>(request, 'DELETE', `/statuses/${statusId}${query}`);
    },
    createTask: async (input) => sendJson<ApiTask>(request, 'POST', '/tasks', input),
    moveTask: async (taskId: string, input: TaskMoveInput) =>
      sendJson<TaskMoveResponse>(request, 'PATCH', `/tasks/${taskId}/move`, input),
  };
}

export const test = base.extend<{ api: AuthedApi }>({
  api: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({
      baseURL: API_ORIGIN,
      storageState: STORAGE_STATE_PATH,
      ignoreHTTPSErrors: true,
    });

    await use(createApi(request));

    await request.dispose();
  },
});
