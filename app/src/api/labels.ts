import { request } from './transport';
import type { LabelSummary } from '../types/api';

// Labels --------------------------------------------------------------------

export async function fetchLabels(): Promise<LabelSummary[]> {
  return request<LabelSummary[]>('/labels');
}

export async function apiCreateLabel(input: { name: string; color?: string }): Promise<LabelSummary> {
  return request<LabelSummary>('/labels', { method: 'POST', body: JSON.stringify(input) });
}

export async function apiUpdateLabel(
  labelId: string,
  input: Partial<{ name: string; color: string }>,
): Promise<LabelSummary> {
  return request<LabelSummary>(`/labels/${labelId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function apiDeleteLabel(labelId: string): Promise<void> {
  await request<unknown>(`/labels/${labelId}`, { method: 'DELETE' });
}
