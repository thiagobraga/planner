# Phase 5 - Recurring Tasks

## Backend Service Changes
- [x] Update `api/src/services/taskService.ts`
  - [x] Modify `completeTask` logic to handle `recurrence_rule` for idempotent recurrence.
  - [x] Mark the current task as `is_completed = true`.
  - [x] Optionally clear the `recurrence_rule` of the completed task to keep it as a static history record.
  - [x] Use `computeNextOccurrence(currentDueDate, task.recurrence_rule)` from `recurrenceEngine.ts` to determine the new due date.
  - [x] Insert a NEW task (clone) with the same properties (title, project, section, labels, priority, etc.) but with the new due date and the original `recurrence_rule`.
  - [x] Emit `SyncEvent` for both the completed task (updated) AND the newly created task.

## Frontend UI Changes
- [x] Update `app/src/components/TaskItem.tsx`
  - [x] Import `Repeat` icon from `lucide-react`.
  - [x] Show the `Repeat` icon next to the due date if `task.recurrenceRule` is present.
- [x] Update `app/src/components/TaskDetail.tsx`
  - [x] Add a Recurrence UI selector (dropdown or buttons for Daily/Weekly/Monthly/Yearly).
  - [x] Handle updating the task with the new `recurrenceRule` object via `apiUpdateTask`.
- [x] Update `app/src/components/QuickAdd.tsx`
  - [x] Expand natural language parsing support to recognize recurrence phrases (e.g., "every day", "every monday", "every month").
  - [x] Parse into a `RecurrenceRule` object and output it in the submission payload.

## Verification
- [x] Manual Tests:
  - [x] Create a task recurring "Weekly on Monday".
  - [x] Complete it.
  - [x] Verify the task goes to "Completed" state.
  - [x] Verify a new task appears next Monday.
  - [x] Complete the new task, verify a third task appears on the following Monday.
