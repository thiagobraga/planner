import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { TaskDetailHost } from '../TaskDetailHost';
import { openTaskDetails, useTaskDetailStore } from '../../../stores/taskDetailStore';
import type { TaskDetailDto, TaskDetailItem } from '../../../contracts/taskDetail';

vi.mock('../../../utils/socket', () => ({ getSocketId: () => 'socket-1', getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));
vi.mock('../../../utils/authEvents', () => ({ notifyUnauthorized: () => {} }));

const ROOT = '11111111-1111-4111-8111-111111111111';
const CHILD = '22222222-2222-4222-8222-222222222222';
const EMPTY = '33333333-3333-4333-8333-333333333333';
const MISSING = '44444444-4444-4444-8444-444444444444';

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
};

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
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const path = String(url).replace(/^.*\/api\/v1/, '');
    const id = path.split('/')[2];
    if (path.endsWith('/document')) return respond(200, { taskId: id, content: { type: 'doc', content: [{ type: 'paragraph' }] }, schemaVersion: 1, revision: 0, updatedAt: null, updatedBy: null });
    if (path.endsWith('/comments')) return respond(200, []);
    if (path.startsWith('/collections')) return respond(200, []);
    if (path.startsWith('/tasks/') && details[id]) return respond(200, details[id]);
    return respond(404, { error: { code: 'NOT_FOUND', message: 'Task not found' } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  useTaskDetailStore.setState({ taskId: null, navigator: null, origin: null, leaveGuard: null });
});

async function loadedPanel(role: 'complementary' | 'dialog' = 'complementary') {
  await screen.findByRole('textbox', { name: 'Title' });
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

  it('shows the whole descendant tree in Only tasks, indented by depth', async () => {
    renderAt(ROOT);
    const panel = await loadedPanel();
    fireEvent.click(within(panel).getByRole('radio', { name: 'Only tasks' }));

    expect(within(panel).getByRole('radio', { name: 'Only tasks' })).toHaveAttribute('aria-checked', 'true');
    expect(within(panel).getByText('1 of 2 done')).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    const rows = within(panel).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Write tests', 'Unit level', 'Ship it', '-Context note']);
    expect(rows[1]).toHaveStyle({ paddingInlineStart: '24px' });
    expect(within(rows[2]).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('textbox', { name: 'Description' })).not.toBeInTheDocument();
  });

  it('opens a subtask with a breadcrumb back to its parent', async () => {
    renderAt(ROOT);
    const panel = await loadedPanel();
    fireEvent.click(within(panel).getByRole('button', { name: 'Open Write tests' }));

    await waitFor(() => expect(within(panel).getByRole('textbox', { name: 'Title' })).toHaveValue('Write tests'));
    const crumbs = within(panel).getByRole('navigation', { name: 'Parent tasks' });
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Plan the slice' }));
    await waitFor(() => expect(within(panel).getByRole('textbox', { name: 'Title' })).toHaveValue('Plan the slice'));
  });

  it('says No subtasks rather than a percentage for an empty plan', async () => {
    renderAt(EMPTY);
    const panel = await loadedPanel();
    expect(await within(panel).findByText('No subtasks')).toBeInTheDocument();
    expect(within(panel).queryByText(/%/)).not.toBeInTheDocument();
  });

  it('explains a missing or forbidden item instead of rendering an empty panel', async () => {
    renderAt(MISSING);
    expect(await screen.findByRole('alert')).toHaveTextContent('does not exist or you do not have access');
  });

  it('is a modal sheet on phones that keeps Tab inside', async () => {
    setPhone(true);
    renderAt(EMPTY);
    const sheet = await loadedPanel('dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(sheet).toHaveFocus());
    await within(sheet).findByRole('textbox', { name: 'Add a comment' });

    const close = within(sheet).getByRole('button', { name: 'Close details' });
    close.focus();
    fireEvent.keyDown(sheet, { key: 'Tab', shiftKey: true });
    expect(sheet.contains(document.activeElement)).toBe(true);
  });
});
