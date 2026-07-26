# Keyboard Navigation - Column-Preserving Up/Down Between Tasks

- [x] 1. Add `onNavigate` prop to `TaskItem` and wire through `TaskList`
  - [x] 1.1 Add prop to `TaskItemProps` interface
  - [x] 1.2 Add to destructure in `TaskItem` function signature
  - [x] 1.3 Add to `TaskCallbacks` pick in `TaskList.tsx`
  - [x] 1.4 Pass `onNavigate` through in `TaskList` JSX
  - [x] 1.5 Add `onNavigate` to `TaskList` destructure
  - [x] 1.6 Verify TypeScript compiles

- [x] 2. Module-level pending column + update `TaskItem` handlers
  - [x] 2.1 Add module-level pending column state
  - [x] 2.2 Update `useEffect([isEditing])` to consume pending column
  - [x] 2.3 Update `handleEditKeyDown` ArrowUp/Down cases
  - [x] 2.4 Verify TypeScript compiles

- [x] 3. Wire `handleNavigate` in `InboxPage`
  - [x] 3.1 Import `setPendingColumn`
  - [x] 3.2 Add `handleNavigate` function
  - [x] 3.3 Pass `onNavigate` to `TaskList`
  - [x] 3.4 Update add-task input ArrowUp handler
  - [x] 3.5 Verify TypeScript compiles

- [x] 4. Verification - manual testing
  - [x] 4.1 Down into next task at same column
  - [x] 4.2 Up into previous task at same column
  - [x] 4.3 ArrowDown from last task goes to add-task input
  - [x] 4.4 ArrowUp from add-task input goes to last task
  - [x] 4.5 ArrowUp from first task = no-op
  - [x] 4.6 Existing behavior intact
