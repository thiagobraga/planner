# Three task views

Daily, Inbox, and Collection pages offer List, Kanban lists, and Kanban cards.

- List remains the default journal list.
- Kanban lists keep the existing horizontal columns while rendering journal rows, labels, subtasks, inline editing, and inline task creation.
- Kanban cards preserves the current card board and existing saved `kanban` choice.
- Daily keeps week navigation and Migrate. Inbox and Collections keep their grouping controls in both Kanban views.

## Relevant Files

- `app/src/types/board.ts`
- `app/src/hooks/useBoardPreferences.ts`
- `app/src/components/ui/ViewToolbar.tsx`
- `app/src/components/board/{BoardToolbar,BoardView,BoardColumn,CollectionBoard,DailyWeekBoard,DailyBoardColumn}.tsx`
- `app/src/components/TaskList.tsx`
- `app/src/pages/{DailyPage,InboxPage,CollectionsPage,StyleguidePage}.tsx`
- `app/src/i18n/locales/{en,pt-BR}.ts`
- `app/src/index.css`
