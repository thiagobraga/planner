# Phase 5 — Recurring Tasks

**Status:** Ready for implementation  
**Dependencies:** None (can be parallelized after Phase 1)  
**Estimated scope:** 2 modified backend files, 2 modified frontend files

## Context

The backend already has a `recurrence_rule` JSONB column on tasks and a complete `recurrenceEngine.ts` that calculates `computeNextOccurrence`. However, the engine is not wired up. Currently, `taskService.ts` just blindly adds 1 day when a recurring task is completed.

Additionally, "idempotent recurrence" is requested. When a user clicks complete on a recurring task, if they double-click or have network lag, the task shouldn't advance multiple times. The best way to achieve idempotent recurrence in a task manager is to **spawn a new task** for the next occurrence, and mark the current task as completed.

## Proposed Changes

### Backend Service Changes

#### [MODIFY] `api/src/services/taskService.ts`

Update `completeTask` logic for recurring tasks:
Instead of mutating the `due_date` of the current task:
1. Mark the current task as `is_completed = true`.
2. Strip its `recurrence_rule` so it's a static completed record (optional, but good for history).
3. Call `computeNextOccurrence(currentDueDate, task.recurrence_rule)` from `recurrenceEngine.ts`.
4. Create a NEW task with the same properties (title, project, section, labels, priority, etc.) but with the new due date and the original `recurrence_rule`.
5. Emit `SyncEvent` for the completed task (updated) AND the newly created task.

This ensures idempotency: completing the task again (if somehow possible) just operates on a completed task, and doesn't advance the next occurrence further.

### Frontend UI Changes

#### [MODIFY] `app/src/components/QuickAdd.tsx`
- Add natural language parsing support for recurrence. E.g., "every day", "every monday", "every month".
- Output the `recurrenceRule` in the submission.

#### [MODIFY] `app/src/components/TaskDetail.tsx`
- Add a UI selector for Recurrence (Daily, Weekly, Monthly, Yearly).
- When a recurrence is set, send it via `apiUpdateTask`.

#### [MODIFY] `app/src/components/TaskItem.tsx`
- Add a visual indicator (e.g., a `Repeat` icon from `lucide-react`) next to the due date if a task has a recurrence rule.

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `api/src/services/taskService.ts` | MODIFY | Implement clone-and-advance recurrence logic |
| `app/src/components/QuickAdd.tsx` | MODIFY | NLP parsing for recurrence |
| `app/src/components/TaskDetail.tsx` | MODIFY | Recurrence picker UI |
| `app/src/components/TaskItem.tsx` | MODIFY | Recurrence icon |

## Verification
- Create a task recurring "Weekly on Monday".
- Complete it.
- Verify the task goes to "Completed" state.
- Verify a new task appears next Monday.
- Complete the new task, verify a third task appears on the following Monday.
