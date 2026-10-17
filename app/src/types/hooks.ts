/** Hook domain types — extracted from hook options and preference keys.
 * Importers rewrite `import type { X } from '../hooks'` to `import type { X } from '../types/hooks'`.
 */

export type VisibilityPreferenceKey = 'hideCompletedTasks' | 'showNotes';

export interface VisibilityPreferenceUpdate {
  key: VisibilityPreferenceKey;
  value: boolean;
}