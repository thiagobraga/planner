# Keyboard Navigation - Column-Preserving Up/Down Between Tasks

- [ ] 1. Add `onNavigate` prop to `TaskItem` and wire through `TaskList`
  - [ ] 1.1 Add prop to `TaskItemProps` interface
  - [ ] 1.2 Add to destructure in `TaskItem` function signature
  - [ ] 1.3 Add to `TaskCallbacks` pick in `TaskList.tsx`
  - [ ] 1.4 Pass `onNavigate` through in `TaskList` JSX
  - [ ] 1.5 Add `onNavigate` to `TaskList` destructure
  - [ ] 1.6 Verify TypeScript compiles

- [ ] 2. Module-level pending column + update `TaskItem` handlers
  - [ ] 2.1 Add module-level pending column state
  - [ ] 2.2 Update `useEffect([isEditing])` to consume pending column
  - [ ] 2.3 Update `handleEditKeyDown` ArrowUp/Down cases
  - [ ] 2.4 Verify TypeScript compiles

- [ ] 3. Wire `handleNavigate` in `InboxPage`
  - [ ] 3.1 Import `setPendingColumn`
  - [ ] 3.2 Add `handleNavigate` function
  - [ ] 3.3 Pass `onNavigate` to `TaskList`
  - [ ] 3.4 Update add-task input ArrowUp handler
  - [ ] 3.5 Verify TypeScript compiles

- [ ] 4. Verification - manual testing
  - [ ] 4.1 Down into next task at same column
  - [ ] 4.2 Up into previous task at same column
  - [ ] 4.3 ArrowDown from last task goes to add-task input
  - [ ] 4.4 ArrowUp from add-task input goes to last task
  - [ ] 4.5 ArrowUp from first task = no-op
  - [ ] 4.6 Existing behavior intact
