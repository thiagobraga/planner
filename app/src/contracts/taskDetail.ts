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

/** Collection label for the task in the detail panel. */
export interface TaskDetailCollection {
  id: string;
  name: string;
}

/** Status badge for the task in the detail panel. */
export interface TaskDetailStatus {
  id: string;
  name: string;
  color: string;
}

/** An agent's active claim on a task; the credential id stays server side. */
export interface TaskDetailClaim {
  label: string;
  actorType: 'token' | 'oauth' | 'session';
  claimedAt: string;
  expiresAt: string;
}

/** GET /tasks/:id: the entry, its ancestors root first, and every descendant in order. */
export interface TaskDetailDto {
  task: TaskDetailItem;
  collection: TaskDetailCollection;
  status: TaskDetailStatus | null;
  ancestors: Array<{ id: string; title: string }>;
  descendants: TaskDetailItem[];
  claim: TaskDetailClaim | null;
}
