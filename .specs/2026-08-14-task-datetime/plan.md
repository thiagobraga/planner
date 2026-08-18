# Specification: Task Due Date, Deadline & Duration

## Feature Summary & User Goals

Allow tasks to hold precise time information, distinguish between planning dates and hard deadlines, and specify expected task duration.

### 1. Due Time for Planned Tasks
- In addition to scheduling a task for a specific date (e.g. August 14), users can specify an exact time of day (e.g. 14:30) when they plan to execute the task.
- Tasks with a time set show the scheduled time alongside the date chip in task lists.

### 2. Hard Deadlines vs. Planned Due Dates
- A task can have a separate hard deadline (date and time) by which it must be completed, independent of the day the user plans to work on it.
- In task lists, deadlines are visually highlighted with an alarm icon so urgent deadlines stand out from everyday scheduled tasks.

### 3. Task Duration & Estimated End Time
- Users can define an estimated duration in minutes (e.g. 30m, 90m).
- When a task has both a scheduled start time and a duration, the system calculates and displays the time window (start time to end time).

### 4. Setting Dates and Times
- **Quick Date & Time Picker**: Right-clicking a task opens the context menu with a "Set date" action that reveals a date and time selector without leaving the page.
- **Task Detail Panel**: Editing a task in the detail sidebar allows configuring the due time, deadline date/time, and duration in minutes.

---

## Relevant Files

- `api/src/db/migrations/040_task_datetime_fields.sql` - Database migration adding deadline and duration columns to tasks.
- `api/src/services/taskService.ts` - Task CRUD logic, time/deadline validation, and derived start/end time formatting.
- `api/src/services/viewService.ts` - View layer task serialization and formatting.
- `api/src/types/task.ts` - API types for task creation and updates.
- `app/src/types/task.ts` - Frontend task interface definitions.
- `app/src/api/client.ts` - API client and task data mappers.
- `app/src/components/TaskItem.tsx` - Task row display for due time, deadline alarm chips, and duration badges.
- `app/src/components/TaskDetail.tsx` - Task detail sidebar form fields for due time, deadline, and duration.
- `app/src/components/ui/ContextMenu.tsx` - Context menu panel extension.
- `app/src/components/ui/TaskDatePickerPanel.tsx` - Inline date and time picker component.
- `app/src/pages/DailyPage.tsx` - Daily view task mapper and context menu integration.
- `app/src/pages/InboxPage.tsx` - Inbox view task mapper and context menu integration.
- `app/src/pages/CollectionsPage.tsx` - Collections view task mapper and context menu integration.
