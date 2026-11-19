import { request } from './transport';
import type { DocumentNode, TaskDocumentDto } from '../contracts/document';
import type { TaskCommentDto } from '../contracts/comment';
import type { TaskDetailDto } from '../contracts/taskDetail';

// Not this tab's socket id: the sync echo then reaches this tab too and every
// list on screen refreshes the row the panel just changed.
const PANEL_SOURCE = { 'X-Socket-Id': 'detail-panel' };

export async function fetchTaskDetail(taskId: string): Promise<TaskDetailDto> {
  return request<TaskDetailDto>(`/tasks/${taskId}`);
}

export async function fetchTaskDocument(taskId: string): Promise<TaskDocumentDto> {
  return request<TaskDocumentDto>(`/tasks/${taskId}/document`);
}

export async function apiSaveTaskDocument(taskId: string, content: DocumentNode, baseRevision: number): Promise<TaskDocumentDto> {
  return request<TaskDocumentDto>(`/tasks/${taskId}/document`, {
    method: 'PUT',
    body: JSON.stringify({ content, baseRevision }),
  });
}

export async function fetchTaskComments(taskId: string): Promise<TaskCommentDto[]> {
  return request<TaskCommentDto[]>(`/tasks/${taskId}/comments`);
}

export async function apiCreateComment(taskId: string, body: string): Promise<TaskCommentDto> {
  return request<TaskCommentDto>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: PANEL_SOURCE,
    body: JSON.stringify({ body }),
  });
}

export async function apiRenameTask(taskId: string, title: string): Promise<void> {
  await request<unknown>(`/tasks/${taskId}`, { method: 'PATCH', headers: PANEL_SOURCE, body: JSON.stringify({ title }) });
}

export async function apiSetTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  await request<unknown>(`/tasks/${taskId}/${completed ? 'complete' : 'reopen'}`, { method: 'POST', headers: PANEL_SOURCE });
}
