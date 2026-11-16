import { request } from './transport';
import type { Preferences } from '../types/api';

export async function fetchPreferences(): Promise<Preferences> {
  return request<Preferences>('/preferences');
}

export async function apiUpdatePreferences(patch: Partial<Omit<Preferences, 'userId'>>): Promise<Preferences> {
  return request<Preferences>('/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Reads typed text like "amanhã às 15h" in the user's time zone; null when it holds no date. */
