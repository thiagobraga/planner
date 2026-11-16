import type { PoolClient } from 'pg';
import type {
  MoveTaskInput,
  ResolvedMoveDestination,
  SubtreeRow,
  TaskRow,
} from '../../types/task.js';
import { verifyCollectionAccess, verifyTaskAccess } from './access.js';
import { MAX_DEPTH, validationError } from './validation.js';

export async function loadAndLockSubtree(
  client: PoolClient,
  taskId: string,
): Promise<SubtreeRow[]> {
  // Lock the dragged task and its descendants for the duration. Two concurrent
  // moves touching the same subtree would otherwise interleave their
  // renumbering and leave duplicate order values behind.
  const subtreeResult = await client.query(
    `WITH RECURSIVE subtree AS (
       SELECT id, parent_task_id, depth, collection_id, section_id, due_date
       FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id, t.parent_task_id, t.depth, t.collection_id, t.section_id, t.due_date
       FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
     )
     SELECT * FROM subtree ORDER BY depth ASC`,
    [taskId],
  );
  const subtree = subtreeResult.rows as SubtreeRow[];
  const subtreeIds = subtree.map((r) => r.id);

  await client.query(`SELECT id FROM tasks WHERE id = ANY($1::uuid[]) FOR UPDATE`, [subtreeIds]);
  return subtree;
}

export async function resolveMoveDestination(
  client: PoolClient,
  task: TaskRow,
  userId: string,
  input: MoveTaskInput,
  subtree: SubtreeRow[],
): Promise<ResolvedMoveDestination> {
  const taskId = task.id;
  const subtreeIds = subtree.map((r) => r.id);

  let destParent: TaskRow | null = null;
  if (input.parentTaskId) {
    if (input.parentTaskId === taskId) {
      throw validationError('parentTaskId', 'A task cannot be its own parent');
    }
    // Reparenting into your own subtree would detach that whole branch from
    // the tree - it would still exist, but nothing would reach it.
    if (subtreeIds.includes(input.parentTaskId)) {
      throw validationError('parentTaskId', 'A task cannot be moved inside its own subtree');
    }
    destParent = await verifyTaskAccess(input.parentTaskId, userId);
  }

  const rootOldDepth = task.depth;
  const rootNewDepth = destParent ? destParent.depth + 1 : 0;
  const depthDelta = rootNewDepth - rootOldDepth;

  const deepest = subtree.reduce((max, r) => Math.max(max, r.depth), rootOldDepth);
  if (deepest + depthDelta > MAX_DEPTH) {
    throw validationError('parentTaskId', `Move would nest deeper than ${MAX_DEPTH} levels`);
  }

  // Reparenting inherits the new parent's collection and section; an explicit
  // collectionId only applies when moving to the top level.
  const destCollectionId = destParent
    ? destParent.collection_id
    : (input.collectionId ?? task.collection_id);
  // `undefined` keeps the current section for plain reorders. When the move
  // transfers the task to another collection without an explicit section, it
  // has to land at top level so collection views can render it.
  const destSectionId = destParent
    ? destParent.section_id
    : input.sectionId !== undefined
      ? input.sectionId
      : input.collectionId !== undefined && input.collectionId !== task.collection_id
        ? null
        : task.section_id;

  // Task ownership can outlive collaboration membership, so task access alone
  // does not prove the user still has access to the resolved destination.
  await verifyCollectionAccess(destCollectionId, userId);

  // `undefined` keeps the current date - that is what makes a sidebar drop
  // file a dated task into a collection without knocking it off its day.
  const destDueDate = input.dueDate === undefined ? task.due_date : input.dueDate;

  const crossesCollection = destCollectionId !== task.collection_id;
  const crossesDate = destDueDate !== task.due_date;
  const destStatusId =
    input.statusId !== undefined
      ? input.statusId
      : crossesCollection
        ? null
        : task.status_id;
  const destPriority = input.priority ?? task.priority;
  const statusChanged = destStatusId !== task.status_id;

  if (input.scope.kind === 'status') {
    if (input.scope.collectionId !== destCollectionId) {
      throw validationError('scope.collectionId', 'Status scope must match the destination collection');
    }
    if (input.scope.statusId !== destStatusId) {
      throw validationError('scope.statusId', 'Status scope must match the destination status');
    }
  }
  if (input.scope.kind === 'priority') {
    if (input.scope.collectionId !== destCollectionId) {
      throw validationError('scope.collectionId', 'Priority scope must match the destination collection');
    }
    if (input.scope.priority !== destPriority) {
      throw validationError('scope.priority', 'Priority scope must match the destination priority');
    }
  }

  let destStatusIsCompletion = false;
  if (destStatusId) {
    const statusResult = await client.query(
      `SELECT s.id, c.completion_status_id
       FROM task_statuses s
       INNER JOIN collections c ON c.id = s.collection_id
       WHERE s.id = $1 AND s.collection_id = $2`,
      [destStatusId, destCollectionId],
    );
    if (statusResult.rows.length === 0) {
      throw validationError('statusId', 'Status must belong to the destination collection');
    }
    destStatusIsCompletion = statusResult.rows[0].completion_status_id === destStatusId;
  }

  return {
    subtreeIds,
    rootNewDepth,
    depthDelta,
    destCollectionId,
    destSectionId,
    destDueDate,
    crossesCollection,
    crossesDate,
    destStatusId,
    destPriority,
    statusChanged,
    destStatusIsCompletion,
  };
}
