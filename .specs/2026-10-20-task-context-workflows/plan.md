# Task menus and collection stage flows

## Goal

Make task context menus a reliable place to complete, reopen, organize, and move tasks. The same actions should be available in Daily, Inbox, and Collections, including list rows, Kanban cards, and calendar entries.

## User flows

1. Opening a task menu shows Complete for an open task or Reopen for a completed task in the first section. Notes and events keep their existing behavior.
2. A list task can be indented under a valid visible predecessor or outdented when it already has a parent. Invalid actions remain visible but disabled.
3. In a collection, each status column can use the following column as its Next destination, choose another status, or disable Next. It can also choose Accept and Reject destinations. The completion column has no outgoing stage actions.
4. Task menus show Move to the resolved next stage, Accept, and Reject when configured. Move and Complete remain separate visible actions even when both lead to completion. A stage action appends a top-level task to its destination; the destination controls completion state.
5. Stage rules work from Daily and Inbox after opening a menu for a collection task. Other sessions see status changes.
6. The date picker remains fully functional with a smaller, lighter panel and compact calendar. Its title has no icon.
7. Entity and options menus have one correctly oriented caret. Empty-space menus have none. A highlighted first row covers the caret behind it while the caret tip remains visible.

## Acceptance

- Rules survive reload and reject destinations outside the collection.
- Deleting a status clears routes that point to it.
- List, Kanban, and calendar task menus offer the applicable actions with mouse, touch, and keyboard access.
- Date, time, deadline, and repeat editing still work.
- Desktop and narrow views work in light and dark themes.

## Relevant Files

- `api/src/db/migrations/049_status_transition_rules.sql` - persistent rules
- `api/src/services/statusService.ts`, `api/src/routes/statuses.ts`, `api/src/types/` - validation, update, cleanup, and response
- `api/src/services/completionSync.ts`, `api/src/services/taskService.ts` - existing completion and move behavior
- `app/src/types/api.ts`, `app/src/api/client.ts` - status contract
- `app/src/pages/DailyPage.tsx`, `app/src/pages/InboxPage.tsx`, `app/src/pages/CollectionsPage.tsx` - menu composition and actions
- `app/src/components/TaskItem.tsx`, `app/src/components/board/`, `app/src/components/ui/ContextMenu.tsx` - task triggers and caret
- `app/src/components/TaskDatePickerPanel.tsx`, `app/src/index.css` - compact panel styling
- `app/src/locales/`, relevant unit and Playwright tests - labels and behavior evidence
