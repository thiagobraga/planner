import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '../../test/render';
import { AUTOSAVE_MS, documentQueryKey, useDocumentDraft } from '../useDocumentDraft';
import type { DocumentNode, TaskDocumentDto } from '../../contracts/document';

vi.mock('../../utils/socket', () => ({ getSocketId: () => 'socket-1' }));
vi.mock('../../utils/authEvents', () => ({ notifyUnauthorized: () => {} }));

const doc = (text: string): DocumentNode => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const dto = (text: string, revision: number): TaskDocumentDto => ({ taskId: 'task-1', content: doc(text), schemaVersion: 1, revision, updatedAt: null, updatedBy: null });

// A tiny stand-in for the document route: compare-and-swap on the revision.
let server: TaskDocumentDto;
let puts: Array<{ content: DocumentNode; baseRevision: number }>;
let failNext: boolean;

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  server = dto('Server text', 3);
  puts = [];
  failNext = false;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') return respond(200, server);
    const body = JSON.parse(String(init.body)) as { content: DocumentNode; baseRevision: number };
    puts.push(body);
    if (failNext) {
      failNext = false;
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    if (body.baseRevision !== server.revision) {
      return respond(409, { error: { code: 'DOCUMENT_CONFLICT', message: 'Conflict', details: [{ current: server }] } });
    }
    server = { ...server, content: body.content, revision: server.revision + 1 };
    return respond(200, server);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

let taskCounter = 0;
function mount() {
  const client = createTestQueryClient();
  const taskId = `task-${++taskCounter}`;
  server = { ...server, taskId };
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useDocumentDraft(taskId), { wrapper });
  return { ...hook, client, taskId };
}

describe('useDocumentDraft', () => {
  it('loads the server document into the editor view', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.view.content).toEqual(doc('Server text')));
    expect(result.current.state.status).toBe('saved');
  });

  it('autosaves after the debounce on the last known revision', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.state.base?.revision).toBe(3));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => result.current.edit(doc('Mine')));
    expect(result.current.state.status).toBe('dirty');
    expect(puts).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10); });
    await waitFor(() => expect(result.current.state.status).toBe('saved'));
    expect(puts).toEqual([{ content: doc('Mine'), baseRevision: 3 }]);
    expect(result.current.state.base?.revision).toBe(4);
  });

  it('keeps the draft on a conflict and lets the user keep theirs on the new revision', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.state.base?.revision).toBe(3));
    server = { ...server, content: doc('Theirs'), revision: 4 };

    act(() => result.current.edit(doc('Mine')));
    await act(() => result.current.save());

    expect(result.current.state.status).toBe('conflict');
    expect(result.current.state.draft).toEqual(doc('Mine'));
    expect(result.current.state.conflict?.revision).toBe(4);

    await act(async () => { result.current.keepMine(); });
    await waitFor(() => expect(result.current.state.status).toBe('saved'));
    expect(puts.at(-1)).toEqual({ content: doc('Mine'), baseRevision: 4 });
    expect(server.content).toEqual(doc('Mine'));
  });

  it('reloads the newer version on request and drops the draft', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.state.base?.revision).toBe(3));
    server = { ...server, content: doc('Theirs'), revision: 4 };
    act(() => result.current.edit(doc('Mine')));
    await act(() => result.current.save());

    act(() => result.current.reload());

    expect(result.current.state).toMatchObject({ status: 'saved', draft: null, conflict: null });
    expect(result.current.view.content).toEqual(doc('Theirs'));
  });

  it('never replaces a dirty draft with a remote update', async () => {
    const { result, client, taskId } = mount();
    await waitFor(() => expect(result.current.view.key).toBe(1));
    act(() => result.current.edit(doc('Mine')));

    await act(async () => {
      client.setQueryData(documentQueryKey(taskId), dto('Remote', 9));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.view.key).toBe(1);
    expect(result.current.state.draft).toEqual(doc('Mine'));
    expect(result.current.state.base?.revision).toBe(3);
  });

  it('replaces a clean editor with a remote update', async () => {
    const { result, client, taskId } = mount();
    await waitFor(() => expect(result.current.view.key).toBe(1));

    act(() => client.setQueryData(documentQueryKey(taskId), dto('Remote', 9)));

    await waitFor(() => expect(result.current.view).toEqual({ key: 2, content: doc('Remote') }));
  });

  it('keeps the draft in memory after a failed save, even across a remount', async () => {
    const first = mount();
    await waitFor(() => expect(first.result.current.state.base?.revision).toBe(3));
    failNext = true;
    act(() => first.result.current.edit(doc('Offline words')));
    await act(() => first.result.current.save());
    expect(first.result.current.state.status).toBe('error');
    expect(first.result.current.state.draft).toEqual(doc('Offline words'));
    first.unmount();

    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={first.client}>{children}</QueryClientProvider>;
    const again = renderHook(() => useDocumentDraft(first.taskId), { wrapper });
    expect(again.result.current.state.draft).toEqual(doc('Offline words'));
    expect(again.result.current.view.content).toEqual(doc('Offline words'));
    await act(() => again.result.current.save());
    await waitFor(() => expect(again.result.current.state.status).toBe('saved'));
  });
});
