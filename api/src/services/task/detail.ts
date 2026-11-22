import type { TaskDetailDto, TaskDetailItem } from '../../contracts/taskDetail.js';
import {
  findTaskAncestors,
  findTaskDescendants,
  findTaskDetailMeta,
  type DetailItemRow,
} from '../../repositories/taskDetailRepository.js';
import { getAccessibleTask } from './access.js';
import { readTaskClaim } from './claim.js';

function formatDetailItem(row: DetailItemRow): TaskDetailItem {
  return {
    id: row.id,
    parentTaskId: row.parent_task_id,
    collectionId: row.collection_id,
    sectionId: row.section_id,
    title: row.title,
    type: row.type as TaskDetailItem['type'],
    isCompleted: row.is_completed,
    statusId: row.status_id,
    priority: row.priority,
    dueDate: row.due_date,
    deadlineDate: row.deadline_date instanceof Date ? row.deadline_date.toISOString() : row.deadline_date,
    orderValue: row.order_value,
    depth: row.depth,
  };
}

/**
 * One entry for the detail panel: the task, its parent chain for the
 * breadcrumb and its whole subtree, completed items included so progress
 * counts are exact whatever the list's hide-completed preference says.
 */
export async function getTaskDetail(taskId: string, userId: string): Promise<TaskDetailDto> {
  const row = await getAccessibleTask(taskId, userId);
  const [ancestors, descendants, claim, meta] = await Promise.all([
    row.parent_task_id ? findTaskAncestors(row.id, row.parent_task_id, row.collection_id) : Promise.resolve([]),
    findTaskDescendants(row.id, row.collection_id),
    readTaskClaim(row.id),
    findTaskDetailMeta(row.collection_id, row.status_id),
  ]);
  return {
    task: formatDetailItem(row),
    collection: { id: row.collection_id, name: meta?.collection_name ?? '' },
    status: row.status_id && meta?.status_name && meta?.status_color
      ? { id: row.status_id, name: meta.status_name, color: meta.status_color }
      : null,
    ancestors,
    descendants: descendants.map(formatDetailItem),
    claim: claim && { label: claim.label, actorType: claim.actorType, claimedAt: claim.claimedAt, expiresAt: claim.expiresAt },
  };
}
