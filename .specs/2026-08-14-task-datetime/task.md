# Task Breakdown: Task Due Date, Deadline & Duration

Detailed implementation breakdown with technical architecture, file references, and actionable subtasks.

---

## 1. Database Schema Migration

- [ ] **1.1 Migration 040**: Create migration `api/src/db/migrations/040_task_datetime_fields.sql`
  - [ ] Add `deadline_date DATE`
  - [ ] Add `deadline_time TIMETZ`
  - [ ] Add `deadline_timezone VARCHAR(100)`
  - [ ] Add `duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0)`

---

## 2. Backend API Services & Data Models

- [ ] **2.1 Task model & interfaces**
  - [ ] Extend `TaskRow` in `api/src/services/taskService.ts` with new columns
  - [ ] Extend `CreateTaskInput` and `UpdateTaskInput` in `api/src/services/taskService.ts`
  - [ ] Extend `formatTask()` in `api/src/services/taskService.ts` to return `dueTime`, `deadlineDate`, `deadlineTime`, `deadlineTimezone`, `durationMinutes`, and derived `startTime` / `endTime`
- [ ] **2.2 Query and mutation updates**
  - [ ] Update `createTask()` SQL INSERT query and parameter bindings in `api/src/services/taskService.ts`
  - [ ] Update `updateTask()` dynamic SET clause builder in `api/src/services/taskService.ts`
  - [ ] Update `completeTask()` task cloning query for recurring tasks in `api/src/services/taskService.ts`
  - [ ] Update `formatTask()` in `api/src/services/viewService.ts` to match
- [ ] **2.3 API unit & integration tests**
  - [ ] Test task creation and updates with `dueTime`, `deadlineDate`, `deadlineTime`, and `durationMinutes` in `api/src/routes/__tests__/tasks.test.ts`
  - [ ] Verify start and end time derivation in `api/src/services/__tests__/taskService.test.ts`

---

## 3. Frontend Types & API Client

- [ ] **3.1 Client API types**
  - [ ] Add new fields to `ApiTask` in `app/src/api/client.ts`
  - [ ] Update `apiCreateTask` and `apiUpdateTask` payload types in `app/src/api/client.ts`
- [ ] **3.2 Component Task interfaces**
  - [ ] Update `Task` interface in `app/src/components/TaskItem.tsx` (or dedicated type file `app/src/types/task.ts`)
  - [ ] Update `apiToTask` mapping helpers in `app/src/pages/DailyPage.tsx`, `app/src/pages/InboxPage.tsx`, and `app/src/pages/CollectionsPage.tsx`

---

## 4. UI Components & Display

- [ ] **4.1 TaskItem badges and chips**
  - [ ] Render formatted `dueTime` (HH:MM) beside `dueDate` chip in `app/src/components/TaskItem.tsx`
  - [ ] Render deadline chip with `AlarmClock` icon when `deadlineDate` is set
  - [ ] Render duration chip (e.g. "30m", "1h 30m") when `durationMinutes` is present
- [ ] **4.2 ContextMenu inline picker panel**
  - [ ] Add optional `panel?: React.ReactNode` field to `ContextMenuItem` in `app/src/components/ui/ContextMenu.tsx`
  - [ ] Update `ContextMenu` rendering to display inline panels
  - [ ] Implement `TaskDatePickerPanel` in `app/src/components/ui/TaskDatePickerPanel.tsx` with date/time pickers and confirm/clear buttons
  - [ ] Connect "Set date" context menu action in `DailyPage.tsx`, `InboxPage.tsx`, and `CollectionsPage.tsx`
- [ ] **4.3 TaskDetail sidebar fields**
  - [ ] Add `dueTime` input to `app/src/components/TaskDetail.tsx`
  - [ ] Add `deadlineDate` and `deadlineTime` inputs to `app/src/components/TaskDetail.tsx`
  - [ ] Add `durationMinutes` input to `app/src/components/TaskDetail.tsx`

---

## 5. Verification & E2E Testing

- [ ] **5.1 Frontend Unit Tests**
  - [ ] Test `TaskItem` renders due time, deadline alarm chip, and duration badge in `app/src/components/__tests__/TaskItem.test.tsx`
  - [ ] Test `TaskDatePickerPanel` submits correct date/time values
- [ ] **5.2 End-to-End Tests**
  - [ ] Add Playwright test for setting due date + time via context menu in `app/e2e/tasks.spec.ts`
  - [ ] Add Playwright test for configuring deadline and duration in task detail panel
- [ ] **5.3 Test Suite Execution**
  - [ ] Run `docker compose exec api npm test`
  - [ ] Run `docker compose exec app npm test`
