// Shared wire contract. api/src/contracts and app/src/contracts must stay
// byte-identical (scripts/check-contracts.sh): types only, no imports.

/** One entry as the detail panel reads it; the full task row carries more fields. */
export interface TaskDetailItem {
  id: string;
  parentTaskId: string | null;
  collectionId: string;
  sectionId: string | null;
  title: string;
  type: 'task' | 'note' | 'event';
  isCompleted: boolean;
  statusId: string | null;
  priority: number;
  dueDate: string | null;
  deadlineDate: string | null;
  orderValue: number;
  depth: number;
}

/** GET /tasks/:id: the entry, its ancestors root first, and every descendant in order. */
export interface TaskDetailDto {
  task: TaskDetailItem;
  ancestors: Array<{ id: string; title: string }>;
  descendants: TaskDetailItem[];
}
