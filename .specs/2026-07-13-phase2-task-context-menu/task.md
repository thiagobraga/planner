# Phase 2 - Task Context Menu & Task Operations

## 1. Backend & API Updates
- [ ] Modify `app/src/api/client.ts`
  - Update `apiUpdateTask` signature to include `projectId` in the allowed `updates` fields.
  - Update `apiCreateTask` signature to accept an `orderValue?: number` parameter.
- [ ] Modify `api/src/services/taskService.ts`
  - Add `orderValue?: number` to `CreateTaskInput` interface.
  - Update the `createTask` INSERT query to use `input.orderValue ?? 0` for the `order_value` column instead of relying strictly on the database default.

## 2. Component Updates (TaskItem & TaskList)
- [ ] Modify `app/src/components/TaskItem.tsx`
  - Add `onRightClick?: (id: string, position: { x: number; y: number }) => void;` to `TaskItemProps`.
  - Add an `onContextMenu` event handler to the outermost DOM element.
  - Inside the handler, call `e.preventDefault()` to suppress the native context menu.
  - Call `onRightClick(task.id, { x: e.clientX, y: e.clientY })` when triggered.
- [ ] Modify `app/src/components/TaskList.tsx`
  - Add `onRightClick` to its props and pass it down to all `TaskItem` components.

## 3. DailyPage - Context Menu State & Logic
- [ ] Modify `app/src/pages/DailyPage.tsx` - State Setup
  - Add state for context menu: `const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);`.
  - Add `handleRightClick` to update `selectedId` and set the `contextMenu` state.
- [ ] Implement Order Calculation Logic (Midpoint)
  - Create a helper to calculate the new `orderValue` when inserting a task.
  - Add below: midpoint between `tasks[i].orderValue` and `tasks[i+1].orderValue` (or `tasks[i].orderValue + 1000` if it's the last).
  - Add above: midpoint between `tasks[i-1].orderValue` and `tasks[i].orderValue` (or `tasks[i].orderValue - 1000` if it's the first).
  - Add logic to trigger a full renumbering (or fallback behavior) if the gap between tasks is `< 2`.
- [ ] Implement `handleAddAbove` & update `handleAddBelow`
  - Add `handleAddAbove(beforeId: string)` using the midpoint order logic. Insert the new task optimistically, set it as editing/selected, and call `apiCreateTask` with `orderValue`.
  - Update the existing `handleAddBelow` to use the midpoint order logic and pass `orderValue` to `apiCreateTask`.
- [ ] Implement Project Assignment Logic
  - Fetch user's projects using `fetchProjects()` from the API client (or via an existing hook/store).
  - Implement a handler to update a task's project via `apiUpdateTask(taskId, { projectId })`. Include logic to move to Inbox ("No project").
- [ ] Implement Context Menu Rendering
  - Render the `ContextMenu` component from Phase 1 at the saved `position`.
  - Add disabled items for: Date, Priority, Tags.
  - Add `Project` submenu showing a list of fetched projects (with colored dots) and a "No project" option.
  - Add separators in appropriate places.
  - Add `Add above` and `Add below` items bound to their respective handlers.
  - Add `Delete` item (destructive styling) bound to the existing `handleDelete`.
  - Ensure the menu closes when an action is taken or when clicking outside.

## 4. Tests & Verification
- [ ] Update / Create Tests
  - Update `app/src/components/__tests__/TaskItem.test.tsx` (or similar) to test that `onRightClick` fires correctly on the contextmenu event.
  - Add tests for the `orderValue` midpoint calculation logic.
- [ ] Verification
  - Check that TypeScript compiles without errors (`cd app && npx tsc --noEmit`).
  - Run linting and ensure no errors.
  - Run tests and ensure they pass.
  - Perform manual verification: Right-click triggers menu, "Add above/below" create tasks properly and ordering persists after reload, "Project" submenu functions, and "Delete" works. Date/Priority/Tags should be present but inactive.
