# Phase 5 - Recurring Tasks

- [ ] Update `api/src/services/taskService.ts`
  - [ ] Modify `completeTask` logic to handle `recurrence_rule`
  - [ ] Mark current task as completed (optionally clearing its recurrence rule)
  - [ ] Use `computeNextOccurrence` from `recurrenceEngine.ts` to get new due date
  - [ ] Insert clone of task with new due date
  - [ ] Emit `SyncEvent` for both the completed task and newly created task

- [ ] Update `app/src/components/TaskItem.tsx`
  - [ ] Import `Repeat` icon from `lucide-react`
  - [ ] Show the icon next to the due date if `task.recurrenceRule` is present

- [ ] Update `app/src/components/TaskDetail.tsx`
  - [ ] Add Recurrence UI (dropdown or buttons for Daily/Weekly/Monthly/Yearly)
  - [ ] Handle updating the task with the new `recurrenceRule` object

- [ ] Update `app/src/components/QuickAdd.tsx` (Optional)
  - [ ] Expand natural language parser to recognize "every [interval]"
  - [ ] Parse into `RecurrenceRule` object and send in payload
