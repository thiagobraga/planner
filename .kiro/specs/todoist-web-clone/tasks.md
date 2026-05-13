# Implementation Plan: Todoist Web Clone

## Overview

Full-stack implementation of a Todoist web clone using React + TypeScript (frontend), Node.js/Express (backend), PostgreSQL (database), Redis (cache/sessions), and WebSocket (real-time sync). Tasks are ordered infrastructure-first, then core features, then advanced features, with property-based tests integrated alongside relevant implementations.

## Tasks

- [x] 1. Database schema and backend project setup
  - [x] 1.1 Set up PostgreSQL database schema with all 16 tables, indexes, and constraints
    - Create migration files for: users, preferences, sessions, projects, collaborators, sections, tasks, task_labels, labels, filters, comments, reminders, activity_events, karma_stats, karma_events, password_reset_tokens, project_invitations
    - Add all indexes defined in design (idx_tasks_user_project, idx_tasks_due_date, idx_tasks_search, etc.)
    - _Requirements: 1.1, 1.6, 10.8, 4.1_

  - [x] 1.2 Set up backend Express application structure with middleware
    - Configure Express with JSON body parsing, CORS, error handling middleware
    - Set up API versioning under `/api/v1`
    - Create error response format: `{ error: { code, message, details? } }`
    - Set up Redis connection for sessions and pub/sub
    - _Requirements: 26.1, 26.2_

  - [x] 1.3 Set up frontend React application structure
    - Configure Zustand store, React Query, and Socket.IO client
    - Set up routing (React Router) for Inbox, Today, Upcoming, project views
    - Create AppShell layout component with responsive breakpoints
    - _Requirements: 27.1, 27.2, 27.3_

- [x] 2. Authentication and session management
  - [x] 2.1 Implement user registration endpoint (POST /auth/register)
    - Validate email (RFC 5322), password (min 8 chars), display name (1-50 chars)
    - Hash password with bcrypt cost 12
    - Create user record and Inbox project in a transaction
    - Return all validation errors in single response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Implement login endpoint (POST /auth/login) with rate limiting
    - Verify credentials, issue JWT access token + opaque refresh token
    - Store session in sessions table with expiration (7+ days)
    - Rate limit: 10 failed attempts per email per 15 minutes → block 15 min
    - Use identical error messages for wrong email vs wrong password
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 Implement auth middleware and logout
    - JWT validation middleware attaching userId to request context
    - Reject expired/unknown tokens with 401
    - Logout endpoint invalidates session within 5 seconds via Redis blacklist
    - _Requirements: 2.5, 2.6, 2.7, 26.1, 26.2, 26.4_

  - [x] 2.4 Implement password reset flow
    - POST /auth/reset-password: send email with single-use token (60 min expiry), generic response regardless of email existence
    - POST /auth/reset-password/confirm: validate token, update password hash, invalidate all sessions
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.5 Write unit tests for auth service
    - Test registration validation (email format, password length, duplicate email)
    - Test login rate limiting logic
    - Test token expiration and invalidation
    - _Requirements: 1.1-1.7, 2.1-2.7, 3.1-3.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Task CRUD and validation
  - [x] 4.1 Implement task creation endpoint (POST /tasks)
    - Validate title (1-500 chars), priority (1-4, default 4), project access, label ownership
    - Default to Inbox if no project specified
    - Return all validation errors in single response; reject immediately if project inaccessible
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [x] 4.2 Implement task update endpoint (PATCH /tasks/:id)
    - Validate title (1-500 chars), description (0-16000 chars), project move clears section_id
    - Reschedule reminders on due date change
    - Return 404 for non-owned/non-shared tasks
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.3 Implement task deletion endpoint (DELETE /tasks/:id)
    - Cascade delete all subtasks recursively
    - Cancel all reminders for deleted tasks
    - Append "task deleted" event to activity log within 2 seconds
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.4 Implement task completion and reopening
    - Non-recurring: set is_completed=true, completed_at=now
    - Recurring: compute next due date via Recurrence_Engine, keep is_completed=false
    - Completion cascades to all subtasks
    - Record history entry; trigger karma update within 5 seconds
    - Reopen: clear completed_at, set is_completed=false
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.5 Write property test for task title validation
    - **Property 8: Task title validation**
    - **Validates: Requirements 4.1, 4.2, 5.1**

  - [x] 4.6 Write property test for task priority validation
    - **Property 9: Task priority validation**
    - **Validates: Requirements 4.6, 4.7**

- [x] 5. Subtask management
  - [x] 5.1 Implement subtask creation and depth enforcement
    - Create subtask inheriting parent's project_id and section_id
    - Enforce max depth of 5 levels below top-level task
    - Detect and reject cyclic parent references
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Implement subtask cascade operations
    - Moving parent moves all descendants to same project, clears section_ids
    - Deleting parent deletes all descendants recursively
    - _Requirements: 8.5, 8.6_

  - [x] 5.3 Write property test for subtask depth enforcement
    - **Property 10: Subtask depth enforcement**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 5.4 Write property test for subtask cycle detection
    - **Property 11: Subtask cycle detection**
    - **Validates: Requirements 8.4**

  - [x] 5.5 Write property test for parent completion cascade
    - **Property 12: Parent completion cascades to all descendants**
    - **Validates: Requirements 6.4**

  - [x] 5.6 Write property test for parent deletion cascade
    - **Property 13: Parent deletion cascades to all descendants**
    - **Validates: Requirements 7.1, 8.6**

  - [x] 5.7 Write property test for moving parent moves descendants
    - **Property 14: Moving parent moves all descendants**
    - **Validates: Requirements 8.5**

- [x] 6. Task ordering
  - [x] 6.1 Implement task reorder endpoint (PATCH /tasks/:id/reorder)
    - Update order_value for moved task and affected siblings
    - Return tasks in ascending order_value when listing
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.2 Write property test for task ordering invariant
    - **Property 15: Task ordering invariant**
    - **Validates: Requirements 9.2, 9.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Project management
  - [x] 8.1 Implement project CRUD endpoints
    - Create: validate name (1-120 chars), color (supported palette), no duplicate names per user
    - Update: same validations, protect Inbox from rename/delete
    - Archive: set is_archived=true, exclude tasks from views
    - Delete: cascade remove sections and tasks
    - Enforce nesting depth max 4 levels
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 8.2 Write property test for project name and color validation
    - **Property 16: Project name and color validation**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x] 8.3 Write property test for archived project exclusion
    - **Property 17: Archived project exclusion from views**
    - **Validates: Requirements 10.5**

  - [x] 8.4 Write property test for project nesting depth
    - **Property 18: Project nesting depth enforcement**
    - **Validates: Requirements 10.9**

- [x] 9. Sections within projects
  - [x] 9.1 Implement section CRUD endpoints
    - Create: validate name (1-120 chars), project access
    - Reorder: update order_values of affected sections
    - Delete: move tasks to parent project with section_id=null
    - Restrict deletion to project owner
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 9.2 Write property test for section deletion moves tasks
    - **Property 28: Section deletion moves tasks to project**
    - **Validates: Requirements 11.3**

- [x] 10. Labels
  - [x] 10.1 Implement label CRUD endpoints
    - Create: validate name (1-60 chars, alphanumeric + underscore only), color, case-insensitive uniqueness per user
    - Delete: remove label and all task associations within 2 seconds
    - Task-label association on task update
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 10.2 Write property test for label name validation
    - **Property 19: Label name validation**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Natural-language date parsing
  - [ ] 12.1 Implement Date_Parser using PEG grammar (peggy)
    - Support absolute formats: YYYY-MM-DD, MM/DD/YYYY, DD MMM YYYY, MMM DD, MMM DD YYYY, DD MMM
    - Support relative: today, tomorrow, yesterday, next <weekday>, in N days/weeks/months
    - Support time: HH:MM, H:MM am/pm, Ham/pm
    - Support recurrence: every day, every <weekday>, every N days/weeks, every month [on the Nth], every year
    - Return error with unrecognized substring on parse failure
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 12.2 Implement Date_Printer (canonical string formatter)
    - Format any structured DueDate back to canonical natural-language string
    - _Requirements: 13.8_

  - [ ] 12.3 Write property test for date parser round-trip
    - **Property 1: Date parser round-trip**
    - **Validates: Requirements 13.8, 13.9**

- [ ] 13. Recurring tasks engine
  - [x] 13.1 Implement Recurrence_Engine
    - Support: every N days, every N weeks on weekdays, every N months on day, every N years on month+day (N: 1-999)
    - Compute next date strictly after current due date
    - Preserve time component
    - Clamp to last day of month when target day doesn't exist
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [ ] 13.2 Write property test for recurrence strict monotonicity
    - **Property 3: Recurrence sequence strict monotonicity**
    - **Validates: Requirements 14.2, 14.9**

  - [ ] 13.3 Write property test for recurrence weekday correctness
    - **Property 4: Recurrence weekday correctness**
    - **Validates: Requirements 14.4**

  - [ ] 13.4 Write property test for recurrence N-day arithmetic
    - **Property 5: Recurrence N-day arithmetic**
    - **Validates: Requirements 14.5**

  - [ ] 13.5 Write property test for recurrence time preservation
    - **Property 6: Recurrence time preservation**
    - **Validates: Requirements 14.6**

  - [ ] 13.6 Write property test for recurrence month-end clamping
    - **Property 7: Recurrence month-end clamping**
    - **Validates: Requirements 14.7**

- [ ] 14. Built-in views (Inbox, Today, Upcoming)
  - [ ] 14.1 Implement Today view endpoint
    - Return incomplete tasks with due_date <= user's current local date
    - Exclude archived projects
    - Group into overdue and today
    - Order by priority ascending, then order_value ascending
    - Use user's configured timezone
    - _Requirements: 15.2, 15.5, 15.6_

  - [ ] 14.2 Implement Upcoming view endpoint
    - Accept date range N (7-30 days), reject outside range
    - Return incomplete tasks within range, exclude archived projects
    - Group by day, order by priority then order_value
    - _Requirements: 15.3, 15.4, 15.5_

  - [ ] 14.3 Implement Inbox view endpoint
    - Return non-completed tasks in user's Inbox project, ordered by order_value ascending
    - _Requirements: 15.1_

  - [ ] 14.4 Write property test for Today view correctness
    - **Property 20: Today view correctness**
    - **Validates: Requirements 15.2, 15.5, 15.6**

  - [ ] 14.5 Write property test for Upcoming view correctness
    - **Property 21: Upcoming view correctness**
    - **Validates: Requirements 15.3, 15.4, 15.5**

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Filter system
  - [ ] 16.1 Implement Filter_Parser using PEG grammar (peggy)
    - Support operators: & (and), | (or), ! (not), parentheses
    - Support operands: #project, @label, p1-p4, today, overdue, no date, due:/due before:/due after:, assigned to:, free-text
    - Return parse error with position of first unexpected token
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

  - [ ] 16.2 Implement Filter_Printer (canonical query string formatter)
    - Format any structured FilterExpr back to canonical query string
    - _Requirements: 16.6_

  - [ ] 16.3 Implement filter CRUD and evaluation endpoints
    - Create/update: validate name (1-120 chars), validate query via parser
    - GET /filters/:id/results: evaluate filter against user's tasks
    - _Requirements: 16.1, 16.8_

  - [ ] 16.4 Write property test for filter parser round-trip
    - **Property 2: Filter parser round-trip**
    - **Validates: Requirements 16.6, 16.7**

  - [ ] 16.5 Write property test for filter evaluation correctness
    - **Property 22: Filter evaluation correctness**
    - **Validates: Requirements 16.8**

- [ ] 17. Search
  - [ ] 17.1 Implement search endpoint (GET /search)
    - Full-text search using pg_trgm across tasks, projects, labels
    - Case-insensitive substring matching
    - Group results by type (Tasks, Projects, Labels)
    - Max 50 per type, ordered by most recently updated
    - Accept 2-200 chars (empty result for <2, error for >200)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ] 17.2 Write property test for search correctness
    - **Property 23: Search correctness**
    - **Validates: Requirements 17.1, 17.2, 17.3**

- [ ] 18. Reminders
  - [ ] 18.1 Implement reminder CRUD and scheduling
    - Auto-schedule reminder when task has due date with time component
    - Manual reminder creation with specific datetime (reject past datetimes)
    - Cancel reminders on task completion/deletion
    - Reschedule on due date update
    - Deliver browser push notification within 60 seconds of scheduled time
    - Suppress if user notifications disabled
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [ ] 19. Task comments
  - [ ] 19.1 Implement comment CRUD endpoints
    - Create: validate body (1-15000 chars), task access check
    - Update: only author can edit, set updated_at
    - Delete: author or task owner can delete
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [ ] 20. Shared projects and collaboration
  - [ ] 20.1 Implement project sharing and invitation flow
    - Share: create pending invitation, send email with link
    - Accept: add user as collaborator with read/create/update/complete access (not delete project or remove collaborators)
    - Task assignment: validate assignee is collaborator/owner
    - Remove collaborator: revoke access within 5 seconds, unassign their tasks
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [ ] 20.2 Write property test for authorization enforcement
    - **Property 26: Authorization enforcement**
    - **Validates: Requirements 26.3, 5.5**

- [ ] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Activity history
  - [ ] 22.1 Implement activity log recording and retrieval
    - Append events on task/project/section create/update/complete/uncomplete/delete
    - Store actor, event type, entity id, timestamp, before/after data
    - GET /activity: paginated (50/page), descending timestamp, project access check
    - Retain events 90+ days
    - _Requirements: 22.1, 22.2, 22.3_

- [ ] 23. Karma and productivity stats
  - [ ] 23.1 Implement karma scoring and streak tracking
    - Increment karma on task completion (amount by priority: p1 highest, p4 lowest)
    - Decrement on uncomplete by same amount
    - Track active days, compute current streak (consecutive days ending today)
    - Expose endpoint: score, current streak, longest streak
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [ ] 23.2 Write property test for karma increment/decrement round-trip
    - **Property 24: Karma increment/decrement round-trip**
    - **Validates: Requirements 23.1, 23.4**

  - [ ] 23.3 Write property test for streak computation
    - **Property 25: Streak computation correctness**
    - **Validates: Requirements 23.3**

- [ ] 24. User preferences
  - [ ] 24.1 Implement preferences endpoints (GET/PATCH /preferences)
    - Validate timezone (IANA), week_start (sunday/monday), theme (light/dark/system)
    - Reject invalid timezone with error
    - _Requirements: 25.1, 25.2, 25.3, 25.4_

- [ ] 25. Real-time synchronization
  - [ ] 25.1 Implement WebSocket sync service with Socket.IO
    - Push change events to all user's other sessions within 2 seconds
    - Push to all collaborators' sessions for shared project changes
    - On reconnection: deliver all missed events during disconnection
    - Client updates local state without page reload
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [ ] 26. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Frontend core UI implementation
  - [ ] 27.1 Implement Sidebar with project tree, labels, and filters navigation
    - Collapsible drawer on mobile (<768px)
    - Project tree with nesting
    - _Requirements: 27.2, 27.3_

  - [ ] 27.2 Implement TaskList and TaskItem components with drag-and-drop
    - Render tasks with checkbox, title, due date, priority, labels
    - Drag-and-drop reordering
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 27.3 Implement TaskDetail editor panel
    - Full task editor: all fields, subtasks, comments
    - _Requirements: 5.1, 5.2, 8.1_

  - [ ] 27.4 Implement QuickAdd dialog with NLP date parsing
    - Open with `q` shortcut, submit with Enter, close with Escape
    - Natural-language date input with preview
    - _Requirements: 24.1, 24.2, 24.3, 13.1_

  - [ ] 27.5 Implement SearchOverlay component
    - Open with `/` shortcut
    - Grouped results (Tasks, Projects, Labels)
    - _Requirements: 24.4, 17.1, 17.2_

  - [ ] 27.6 Implement FilterBar with syntax highlighting
    - Filter query input with live validation
    - _Requirements: 16.1, 16.3_

- [ ] 28. Frontend views and state management
  - [ ] 28.1 Implement Inbox, Today, and Upcoming views
    - Connect to backend endpoints
    - Proper grouping and ordering
    - Update within 2 seconds of backend changes
    - _Requirements: 15.1, 15.2, 15.3, 15.7_

  - [ ] 28.2 Implement optimistic updates with revert on failure
    - Reflect changes in UI within 100ms
    - Revert to pre-mutation state within 2000ms on API error
    - _Requirements: 28.2, 28.3_

  - [ ] 28.3 Write property test for optimistic update revert
    - **Property 27: Optimistic update revert on API failure**
    - **Validates: Requirements 28.2, 28.3**

  - [ ] 28.4 Implement offline support with queue and replay
    - Display offline indicator within 5 seconds of connectivity loss
    - Queue edits in IndexedDB, replay in order on reconnection
    - _Requirements: 27.6, 27.7_

- [ ] 29. Keyboard shortcuts and accessibility
  - [ ] 29.1 Implement ShortcutHandler with all keyboard shortcuts
    - q: quick-add, /: search, ?: help panel
    - Enter: edit selected task, Delete: confirm deletion
    - g+i: Inbox, g+t: Today, g+u: Upcoming (within 1 second)
    - _Requirements: 24.1-24.10_

  - [ ] 29.2 Implement accessibility (WAI-ARIA 1.2 compliance)
    - Keyboard focus indicators on all interactive elements
    - Semantic roles and labels for navigation, lists, buttons, dialogs
    - _Requirements: 27.5_

- [ ] 30. Performance and responsive design
  - [ ] 30.1 Implement responsive layouts (320px-2560px)
    - Single-column below 768px, multi-column at/above 768px
    - Today view renders within 1000ms with 200 tasks
    - _Requirements: 27.1, 27.2, 27.4, 28.1_

- [ ] 31. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check (min 100 iterations)
- Unit tests validate specific examples and edge cases
- PEG grammars (peggy) are used for both date and filter parsers
- All timestamps in UTC (ISO 8601), IDs are UUIDs v4
- Cursor-based pagination throughout API

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6", "5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7", "6.1"] },
    { "id": 7, "tasks": ["6.2", "8.1", "9.1", "10.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "9.2", "10.2"] },
    { "id": 9, "tasks": ["12.1", "13.1"] },
    { "id": 10, "tasks": ["12.2", "13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 11, "tasks": ["12.3", "14.1", "14.2", "14.3"] },
    { "id": 12, "tasks": ["14.4", "14.5", "16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3", "17.1"] },
    { "id": 14, "tasks": ["16.4", "16.5", "17.2", "18.1", "19.1"] },
    { "id": 15, "tasks": ["20.1", "22.1", "23.1", "24.1"] },
    { "id": 16, "tasks": ["20.2", "23.2", "23.3", "25.1"] },
    { "id": 17, "tasks": ["27.1", "27.2", "27.3", "27.4", "27.5", "27.6"] },
    { "id": 18, "tasks": ["28.1", "28.2", "28.4"] },
    { "id": 19, "tasks": ["28.3", "29.1", "29.2", "30.1"] }
  ]
}
```
