# Phase 6 - Tree-Aware Indent Levels

- [ ] 1. Create `app/src/utils/taskTree.ts`
  - [ ] 1.1 `getParentCandidate(tasks, index)` - walk backward from index, return first task at same or lower indent
  - [ ] 1.2 `getDescendants(tasks, index)` - collect all tasks where `parentTaskId` chains from this task
  - [ ] 1.3 `computeIndent(tasks, id, dir)` - returns `{ indent, parentTaskId, affectedDescendants[] }` applying all rules

- [ ] 2. Update `handleIndent` in all pages
  - [ ] 2.1 InboxPage - tree-aware indent with descendant shift
  - [ ] 2.2 DailyPage - same
  - [ ] 2.3 ProjectsPage - same
  - [ ] 2.4 UpcomingPage - add `handleIndent`
  - [ ] 2.5 SearchPage - add `handleIndent`

- [ ] 3. Update API client to send `parentTaskId`
  - [ ] 3.1 Send `parent_task_id` in `PATCH /tasks/:id` body
  - [ ] 3.2 Send `depth` updates for all shifted descendants (or rely on parent-child tree on backend)

- [ ] 4. Visual verification
  - [ ] 4.1 Tab from first task = no-op
  - [ ] 4.2 Tab on second+ task = nests under preceding
  - [ ] 4.3 Shift+Tab on child = promotes one level
  - [ ] 4.4 Indenting parent = children follow
  - [ ] 4.5 Solo task Tab/Shift+Tab = no-op
  - [ ] 4.6 Verify all views: Inbox, Today, Upcoming, Project, Search
