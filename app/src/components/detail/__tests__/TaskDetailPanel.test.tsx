import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { TaskDetailHost } from '../TaskDetailHost';
import { clearDocumentDrafts } from '../../../hooks/useDocumentDraft';
import { openTaskDetails, useTaskDetailStore } from '../../../stores/taskDetailStore';
import type { TaskDetailDto, TaskDetailItem } from '../../../contracts/taskDetail';

vi.mock('../../../utils/socket', () => ({ getSocketId: () => 'socket-1', getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));
vi.mock('../../../utils/authEvents', () => ({ notifyUnauthorized: () => {} }));
vi.mock('../../../utils/offlineQueue', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../utils/offlineQueue')>()), isOnline: () => true }));

const ROOT = '11111111-1111-4111-8111-111111111111';
const CHILD = '22222222-2222-4222-8222-222222222222';
const EMPTY = '33333333-3333-4333-8333-333333333333';
const MISSING = '44444444-4444-4444-8444-444444444444';
const UNSUPPORTED = '55555555-5555-4555-8555-555555555555';
const EMBED = '66666666-6666-4666-8666-666666666666';
const LINKED = '77777777-7777-4777-8777-777777777777';
const LOOSE = '88888888-8888-4888-8888-888888888888';

const item = (id: string, title: string, parentTaskId: string | null, extra: Partial<TaskDetailItem> = {}): TaskDetailItem => ({
  id, title, parentTaskId, collectionId: 'col', sectionId: null, type: 'task', isCompleted: false, statusId: null,
  priority: 4, dueDate: null, deadlineDate: null, orderValue: 0, depth: 0, ...extra,
});

const details: Record<string, TaskDetailDto> = {
  [ROOT]: {
    task: item(ROOT, 'Plan the slice', null),
    ancestors: [],
    descendants: [
      item(CHILD, 'Write tests', ROOT, { orderValue: 1 }),
      item('c2', 'Ship it', ROOT, { orderValue: 2, isCompleted: true }),
      item('c3', 'Unit level', CHILD, { orderValue: 1 }),
      item('n1', 'Context note', ROOT, { orderValue: 3, type: 'note' }),
    ],
  },
  [CHILD]: { task: item(CHILD, 'Write tests', ROOT), ancestors: [{ id: ROOT, title: 'Plan the slice' }], descendants: [item('c3', 'Unit level', CHILD)] },
  [EMPTY]: { task: item(EMPTY, 'Lonely task', null), ancestors: [], descendants: [] },
  [UNSUPPORTED]: { task: item(UNSUPPORTED, 'Future doc', null), ancestors: [], descendants: [] },
  [EMBED]: {
    task: item(EMBED, 'Embedded plan', null),
    ancestors: [],
    descendants: [item(LINKED, 'Linked in prose', EMBED, { orderValue: 1 }), item(LOOSE, 'Loose subtask', EMBED, { orderValue: 2 })],
  },
};

let patchCalls: Array<{ url: string; body: unknown }> = [];
let postCalls: Array<{ url: string; body: unknown }> = [];

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width: 640px'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  setPhone(false);
  patchCalls = [];
  postCalls = [];
  details[EMBED].descendants = details[EMBED].descendants.slice(0, 2);
  clearDocumentDrafts();
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/api\/v1/, '');
    const id = path.split('/')[2];
    if (init?.method === 'PATCH') {
      patchCalls.push({ url: path, body: init.body ? JSON.parse(String(init.body)) : null });
      return respond(200, {});
    }
    if (init?.method === 'POST') {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      postCalls.push({ url: path, body });
      if (path === '/tasks') {
        const created = item('99999999-9999-4999-8999-999999999999', body.title, body.parentTaskId, { orderValue: 3 });
        details[EMBED].descendants = [...details[EMBED].descendants, created];
        return respond(201, { ...created, userId: 'u1' });
      }
      return respond(200, {});
    }
    if (path.endsWith('/document')) {
      if (id === EMBED) {
        return respond(200, {
          taskId: id,
          content: {
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Plan intro' }] },
              { type: 'taskReference', attrs: { taskId: LINKED, blockId: 'b1' } },
            ],
          },
          schemaVersion: 1, revision: 1, updatedAt: null, updatedBy: null,
        });
      }
      if (id === UNSUPPORTED) {
        return respond(200, {
          taskId: id,
          content: {
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Visible fallback text' }] },
              { type: 'callout', content: [{ type: 'text', text: 'Future block' }] },
            ],
          },
          schemaVersion: 1,
          revision: 1,
          updatedAt: null,
          updatedBy: null,
        });
      }
      return respond(200, { taskId: id, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Initial notes' }] }] }, schemaVersion: 1, revision: 0, updatedAt: null, updatedBy: null });
    }
    if (path.endsWith('/comments')) return respond(200, []);
    if (path.startsWith('/collections')) return respond(200, []);
    if (path.includes('/statuses')) return respond(200, []);
    if (path.startsWith('/tasks/') && details[id]) return respond(200, details[id]);
    return respond(404, { error: { code: 'NOT_FOUND', message: 'Task not found' } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearDocumentDrafts();
  useTaskDetailStore.setState({ taskId: null, navigator: null, origin: null, focusRequest: 0, leaveGuard: null });
});

async function loadedPanel(role: 'complementary' | 'dialog' = 'complementary') {
  await screen.findByRole('textbox', { name: 'Title' }, { timeout: 5000 });
  return screen.getByRole(role, { name: 'Task details' });
}

function renderAt(taskId?: string) {
  return renderWithProviders(
    <>
      <button type="button" data-task-id="row">Origin row</button>
      <TaskDetailHost />
    </>,
    undefined,
    [taskId ? `/inbox?task=${taskId}` : '/inbox'],
  );
}

describe('TaskDetailPanel', () => {
  it('opens from a row, shows progress over task leaves and returns focus to the row on close', async () => {
    renderAt();
    const row = screen.getByRole('button', { name: 'Origin row' });
    row.focus();
    act(() => openTaskDetails(ROOT, { origin: row }));

    const panel = await loadedPanel();
    expect(within(panel).getByRole('textbox', { name: 'Title' })).toHaveValue('Plan the slice');
    expect(within(panel).getByText('1 of 2 tasks · 50%')).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Other subtasks' })).toBeInTheDocument();
    await screen.findByRole('textbox', { name: 'Description' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Task details' })).not.toBeInTheDocument());
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('cancels an inline title edit on Escape without calling rename', async () => {
    renderAt(ROOT);
    const panel = await loadedPanel();
    const titleInput = within(panel).getByRole('textbox', { name: 'Title' });

    fireEvent.change(titleInput, { target: { value: 'Accidental edit' } });
    expect(titleInput).toHaveValue('Accidental edit');
    fireEvent.keyDown(titleInput, { key: 'Escape' });

    expect(titleInput).toHaveValue('Plan the slice');
    expect(patchCalls).toHaveLength(0);
  });

  it('shows the whole descendant tree in Only tasks and preserves description across mode switches', async () => {
    renderAt(ROOT);
    const panel = await loadedPanel();
    expect(await screen.findByRole('textbox', { name: 'Description' })).toHaveTextContent('Initial notes');

    fireEvent.click(within(panel).getByRole('radio', { name: 'Only tasks' }));

    expect(within(panel).getByRole('radio', { name: 'Only tasks' })).toHaveAttribute('aria-checked', 'true');
    expect(within(panel).getByText('1 of 2 done')).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    const rows = within(panel).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Write tests', 'Unit level', 'Ship it', '-Context note']);
    expect(rows[1]).toHaveStyle({ paddingInlineStart: '24px' });
    expect(within(rows[2]).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('textbox', { name: 'Description' })).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('radio', { name: 'Full content' }));
    expect(await screen.findByRole('textbox', { name: 'Description' })).toHaveTextContent('Initial notes');
  });

  it('renders readable fallback text instead of a blank editor when a document contains unsupported blocks', async () => {
    renderAt(UNSUPPORTED);
    const panel = await loadedPanel();
    expect(await within(panel).findByText(/read only/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Visible fallback text/)).toBeInTheDocument();
  });

  it('renders an embedded task as a live row in the text and keeps only unlinked subtasks under Other subtasks', async () => {
    renderAt(EMBED);
    const panel = await loadedPanel();
    const editor = await screen.findByRole('textbox', { name: 'Description' });
    expect(await within(editor).findByRole('button', { name: 'Open Linked in prose' })).toBeInTheDocument();
    const others = within(panel).getByRole('region', { name: 'Other subtasks' });
    expect(within(others).getByText('Loose subtask')).toBeInTheDocument();
    expect(within(others).queryByText('Linked in prose')).not.toBeInTheDocument();

    fireEvent.click(within(editor).getByRole('checkbox', { name: 'Complete: Linked in prose' }));
    await waitFor(() => expect(postCalls.some((call) => call.url === `/tasks/${LINKED}/complete`)).toBe(true));
  });

  it('creates a real child task from the editor and inserts its block at the caret', async () => {
    renderAt(EMBED);
    const panel = await loadedPanel();
    await screen.findByRole('textbox', { name: 'Description' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add task to text' }));
    const input = await within(panel).findByRole('textbox', { name: 'New task title' });
    fireEvent.change(input, { target: { value: 'Brand new step' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(postCalls.find((call) => call.url === '/tasks')?.body).toMatchObject({ title: 'Brand new step', parentTaskId: EMBED, collectionId: 'col' }));
    const editor = screen.getByRole('textbox', { name: 'Description' });
    expect(await within(editor).findByRole('button', { name: 'Open Brand new step' })).toBeInTheDocument();
  });

  it('opens a subtask with a breadcrumb back to its parent', async () => {
    renderAt(ROOT);
    const panel = await loadedPanel();
    await screen.findByRole('textbox', { name: 'Description' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Open Write tests' }));

    await waitFor(() => expect(within(panel).getByRole('textbox', { name: 'Title' })).toHaveValue('Write tests'));
    await screen.findByRole('textbox', { name: 'Description' });
    const crumbs = within(panel).getByRole('navigation', { name: 'Parent tasks' });
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Plan the slice' }));
    await waitFor(() => expect(within(panel).getByRole('textbox', { name: 'Title' })).toHaveValue('Plan the slice'));
    await screen.findByRole('textbox', { name: 'Description' });
  });

  it('says No subtasks rather than a percentage for an empty plan', async () => {
    renderAt(EMPTY);
    const panel = await loadedPanel();
    expect(await within(panel).findByText('No subtasks')).toBeInTheDocument();
    expect(within(panel).queryByText(/%/)).not.toBeInTheDocument();
    await screen.findByRole('textbox', { name: 'Description' });
  });

  it('explains a missing or forbidden item instead of rendering an empty panel', async () => {
    renderAt(MISSING);
    expect(await screen.findByRole('alert')).toHaveTextContent('does not exist or you do not have access');
  });

  it('is a modal sheet on phones that wraps Tab and Shift+Tab between first and last focusable controls', async () => {
    setPhone(true);
    renderAt(EMPTY);
    const sheet = await loadedPanel('dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(sheet).toHaveFocus());
    const commentBox = await within(sheet).findByRole('textbox', { name: 'Add a comment' });
    // Type into comment so the submit button is enabled and becomes the last focusable element
    fireEvent.change(commentBox, { target: { value: 'hello' } });
    const commentBtn = within(sheet).getByRole('button', { name: 'Comment' });
    expect(commentBtn).not.toBeDisabled();

    const close = within(sheet).getByRole('button', { name: 'Close details' });
    close.focus();
    fireEvent.keyDown(sheet, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(commentBtn);

    fireEvent.keyDown(sheet, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(close);
  });
});
