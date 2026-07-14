# Phase 6 - Tree-Aware Indent Levels

- [x] 1. Create `app/src/utils/taskTree.ts`
  - [x] 1.1 `getParentCandidate(tasks, index)` - walk backward from index, return first task at same or lower indent
  - [x] 1.2 `getDescendants(tasks, index)` - collect all tasks where `parentTaskId` chains from this task
  - [x] 1.3 `computeIndent(tasks, id, dir)` - returns `{ indent, parentTaskId, affectedDescendants[] }` applying all rules

- [x] 2. Update `handleIndent` in all pages
  - [x] 2.1 InboxPage - tree-aware indent with descendant shift
  - [x] 2.2 DailyPage - same
  - [x] 2.3 ProjectsPage - same
  - [x] 2.4 UpcomingPage - add `handleIndent`
  - [x] 2.5 SearchPage - add `handleIndent`

- [x] 3. Update API client to send `parentTaskId`
  - [x] 3.1 Send `parent_task_id` in `PATCH /tasks/:id` body
  - [x] 3.2 Send `depth` updates for all shifted descendants (or rely on parent-child tree on backend)

- [x] 4. Visual verification
  - [x] 4.1 Tab from first task = no-op
  - [x] 4.2 Tab on second+ task = nests under preceding
  - [x] 4.3 Shift+Tab on child = promotes one level
  - [x] 4.4 Indenting parent = children follow
  - [x] 4.5 Solo task Tab/Shift+Tab = no-op
  - [x] 4.6 Verify all views: Inbox, Today, Upcoming, Project, Search
