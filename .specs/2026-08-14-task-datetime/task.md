# Task Breakdown: Task Due Date, Deadline & Duration

Detailed implementation breakdown with technical architecture, file references, and actionable subtasks.

---

## 1. Database Schema Migration

- [x] **1.1 Migration 044**: Create migration `api/src/db/migrations/044_task_datetime_fields.sql`
  - [x] Add `deadline_date DATE`
  - [x] Add `deadline_time TIMETZ`
  - [x] Add `deadline_timezone VARCHAR(100)`
  - [x] Add `duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0)`

---

## 2. Backend API Services & Data Models

- [x] **2.1 Task model & interfaces**
  - [x] Extend `TaskRow` in `api/src/services/taskService.ts` with new columns
  - [x] Extend `CreateTaskInput` and `UpdateTaskInput` in `api/src/services/taskService.ts`
  - [x] Extend `formatTask()` in `api/src/services/taskService.ts` to return `dueTime`, `deadlineDate`, `deadlineTime`, `deadlineTimezone`, `durationMinutes`, and derived `startTime` / `endTime`
- [x] **2.2 Query and mutation updates**
  - [x] Update `createTask()` SQL INSERT query and parameter bindings in `api/src/services/taskService.ts`
  - [x] Update `updateTask()` dynamic SET clause builder in `api/src/services/taskService.ts`
  - [x] Update `completeTask()` task cloning query for recurring tasks in `api/src/services/taskService.ts`
  - [x] Update `formatTask()` in `api/src/services/viewService.ts` to match
- [x] **2.3 API unit & integration tests**
  - [x] Test task creation and updates with `dueTime`, `deadlineDate`, `deadlineTime`, and `durationMinutes` in `api/src/routes/__tests__/tasks.test.ts`
  - [x] Verify start and end time derivation in `api/src/services/__tests__/taskService.test.ts`

---

## 3. Frontend Types & API Client

- [x] **3.1 Client API types**
  - [x] Add new fields to `ApiTask` in `app/src/api/client.ts`
  - [x] Update `apiCreateTask` and `apiUpdateTask` payload types in `app/src/api/client.ts`
- [x] **3.2 Component Task interfaces**
  - [x] Update `Task` interface in `app/src/components/TaskItem.tsx` (or dedicated type file `app/src/types/task.ts`)
  - [x] Update `apiToTask` mapping helpers in `app/src/pages/DailyPage.tsx`, `app/src/pages/InboxPage.tsx`, and `app/src/pages/CollectionsPage.tsx`

---

## 4. UI Components & Display

- [x] **4.1 TaskItem badges and chips**
  - [x] Render formatted `dueTime` (HH:MM) beside `dueDate` chip in `app/src/components/TaskItem.tsx`
  - [x] Render deadline chip with `AlarmClock` icon when `deadlineDate` is set
  - [x] Render duration chip (e.g. "30m", "1h 30m") when `durationMinutes` is present
- [x] **4.2 ContextMenu inline picker panel**
  - [x] Add optional `panel?: React.ReactNode` field to `ContextMenuItem` in `app/src/components/ui/ContextMenu.tsx`
  - [x] Update `ContextMenu` rendering to display inline panels
  - [x] Implement `TaskDatePickerPanel` in `app/src/components/ui/TaskDatePickerPanel.tsx` with date/time pickers and confirm/clear buttons
  - [x] Connect "Set date" context menu action in `DailyPage.tsx`, `InboxPage.tsx`, and `CollectionsPage.tsx`
- [x] **4.3 TaskDetail sidebar fields**
  - [x] Add `dueTime` input to `app/src/components/TaskDetail.tsx`
  - [x] Add `deadlineDate` and `deadlineTime` inputs to `app/src/components/TaskDetail.tsx`
  - [x] Add `durationMinutes` input to `app/src/components/TaskDetail.tsx`

---

## 5. Verification & E2E Testing

- [x] **5.1 Frontend Unit Tests**
  - [x] Test `TaskItem` renders due time, deadline alarm chip, and duration badge in `app/src/components/__tests__/TaskItem.test.tsx`
  - [x] Test `TaskDatePickerPanel` submits correct date/time values
- [x] **5.2 End-to-End Tests**
  - [x] Add Playwright test for setting due date + time via context menu in `app/e2e/tasks.spec.ts`
  - [x] Add Playwright test for configuring deadline and duration in task detail panel
- [x] **5.3 Test Suite Execution**
  - [x] Run `docker compose exec api npm test`
  - [x] Run `docker compose exec app npm test`

---

## Implementation Notes

- Migration renumbered to 044 (040-043 were taken by the time work started). `duration_minutes` capped at 1440.
- Time formatting lives in `api/src/utils/taskTime.ts` (`formatTimeFields`), shared by `taskService` and `viewService`.
- A time without its date is rejected with `VALIDATION_ERROR`; clearing a date also clears its time and time zone.
- Recurring clones keep time and duration, and shift the deadline by the same number of days as the due date.
- `Task.dueTime` is the row's start time; the API's `startTime` mirrors it, `endTime` is derived.
- Duration chip only renders when there is no start time; the start-end window already conveys it.
- `ContextMenuItem.panel` is a render prop `(close) => ReactNode` so the panel can dismiss the menu after saving.
- The Set date panel also edits deadline and duration, since `TaskDetail` is not mounted on any route.
- E2E: `app/e2e/taskDatetime.spec.ts`. Integration: `api/src/services/__tests__/taskService.datetime.integration.test.ts`.
