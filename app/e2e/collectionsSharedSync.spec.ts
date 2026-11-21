import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import type { APIRequestContext } from '@playwright/test';
import { API_URL, BASE_URL, expect, STORAGE_STATE_PATH, test } from './fixtures/api';
import type { SyncEvent } from '../src/hooks/useSync';

test.use({ storageState: STORAGE_STATE_PATH });

async function connectSync(request: APIRequestContext) {
  const { cookies } = await request.storageState();
  const session = cookies.find((cookie) => cookie.name.endsWith('_session'))!;
  const socket = io(BASE_URL, {
    autoConnect: false,
    transports: ['polling'],
    withCredentials: true,
    forceNew: true,
    rejectUnauthorized: false,
    extraHeaders: { Origin: BASE_URL, Cookie: `${session.name}=${session.value}` },
  });
  const events: SyncEvent[] = [];
  socket.on('sync', (event: SyncEvent) => events.push(event));
  let connectionError: string | undefined;
  socket.on('connect_error', (error) => { connectionError = error.message; });
  socket.connect();
  try {
    await expect.poll(() => socket.connected).toBe(true);
    return { socket, events };
  } catch (error) {
    socket.disconnect();
    throw new Error(connectionError ?? 'Socket did not connect', { cause: error });
  }
}

test('source members see moved tasks disappear and revoked members stop receiving section notifications', async ({ api, playwright, browser }) => {
  const source = await api.createCollection({ name: 'Shared sync source', color: '#c9483b' });
  const destination = await api.createCollection({ name: 'Private sync destination', color: '#c9483b' });
  const other = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const email = `shared-sync-${randomUUID()}@example.com`;
  const password = 'Local-shared-sync-test-only-123!';
  let ownerSync: Awaited<ReturnType<typeof connectSync>> | undefined;
  let otherSync: Awaited<ReturnType<typeof connectSync>> | undefined;
  let guest: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const signup = await other.post(`${API_URL}/auth/register`, { data: { email, password, displayName: 'Shared sync tester' } });
    expect(signup.ok()).toBe(true);
    const login = await other.post(`${API_URL}/auth/login`, { data: { email, password } });
    expect(login.ok()).toBe(true);
    const { user } = await login.json();
    const { token } = await api.post<{ token: string }>(`/collections/${source.id}/invitations`, { email });
    await other.get(`${API_URL}/collections`);
    const cookie = (await other.storageState()).cookies.find((entry) => entry.name.endsWith('_csrf'))!;
    const accepted = await other.post(`${API_URL}/invitations/accept`, {
      data: { token },
      headers: { 'X-XSRF-TOKEN': decodeURIComponent(cookie.value).split(':', 1)[0] },
    });
    expect(accepted.ok()).toBe(true);

    const task = await api.createTask({ title: 'Task in the shared source', collectionId: source.id });
    ownerSync = await connectSync(api.request);
    otherSync = await connectSync(other);
    guest = await browser.newContext({ baseURL: BASE_URL, storageState: await other.storageState(), ignoreHTTPSErrors: true });
    const guestPage = await guest.newPage();
    await guestPage.goto(`/collection/${source.id}`);
    const taskRow = guestPage.getByText(task.title, { exact: true });
    await expect(taskRow).toBeVisible();

    const first = await api.post<{ id: string }>(`/collections/${source.id}/sections`, { name: 'Visible section' });
    await expect(guestPage.getByLabel('Visible section', { exact: true })).toBeVisible();
    await expect.poll(() => otherSync?.events.find((event) => event.entityId === first.id)?.entityType).toBe('section');

    await api.moveTask(task.id, {
      collectionId: destination.id, parentTaskId: null,
      scope: { kind: 'collection', collectionId: destination.id }, position: 0,
    });
    await expect(taskRow).toHaveCount(0);
    await expect.poll(() => otherSync?.events.find((event) => event.entityId === task.id)).toMatchObject({
      entityType: 'task', collectionId: source.id,
    });
    const movedEvents = otherSync.events.filter((event) => event.entityId === task.id);
    expect(movedEvents).toHaveLength(1);
    expect(movedEvents[0].payload).toBeUndefined();

    const patchMoved = await api.createTask({ title: 'Task moved through collection picker', collectionId: source.id });
    const patchRow = guestPage.getByText(patchMoved.title, { exact: true });
    await expect(patchRow).toBeVisible();
    await api.patch(`/tasks/${patchMoved.id}`, { collectionId: destination.id });
    await expect(patchRow).toHaveCount(0);
    await expect.poll(() => otherSync?.events.find((event) => event.entityId === patchMoved.id)).toMatchObject({
      entityType: 'task', collectionId: source.id,
    });

    await api.delete(`/collections/${source.id}/collaborators/${user.id}`);
    const second = await api.post<{ id: string }>(`/collections/${source.id}/sections`, { name: 'Private after revocation' });
    await expect.poll(() => ownerSync?.events.some((event) => event.entityId === second.id)).toBe(true);
    expect(otherSync.socket.connected).toBe(true);
    expect(otherSync.events.some((event) => event.entityId === second.id)).toBe(false);
  } finally {
    ownerSync?.socket.disconnect();
    otherSync?.socket.disconnect();
    await guest?.close();
    await other.dispose();
    await api.deleteCollection(source.id);
    await api.deleteCollection(destination.id);
  }
});
