# Requirements Document

## Introduction

This document describes the requirements for a web-based clone of Todoist, a task management application. Users can register accounts, capture tasks with titles, descriptions, natural-language due dates, priorities, labels, and subtasks, organize them into nested projects and sections, create recurring tasks, view them through Inbox, Today, Upcoming, and custom filter views, search across tasks, projects, and labels, receive reminders, attach comments to tasks, collaborate on shared projects with task assignment, review an append-only activity history, configure time zone, week start, and theme preferences, and synchronize changes across open sessions in real time. The application targets modern desktop and mobile web browsers only. A gamification layer is intentionally left out of this specification and will be defined separately. Out of scope for this specification: native mobile apps, desktop apps, email integrations, third-party integrations (Slack, Calendar, Zapier), and paid subscription tiers.

## Glossary

- **System**: The complete Todoist web clone application, including frontend, backend, and database.
- **Web_Client**: The browser-based single-page application rendered for the User.
- **API_Server**: The backend HTTP/JSON service that handles requests from the Web_Client and persists data.
- **Auth_Service**: The subsystem of the API_Server responsible for user registration, login, session management, and password reset.
- **Task_Service**: The subsystem of the API_Server responsible for Task CRUD operations, completion, ordering, comments, and history entries.
- **Project_Service**: The subsystem of the API_Server responsible for Project and Section CRUD operations and Collaborator management.
- **Label_Service**: The subsystem of the API_Server responsible for Label CRUD operations and Task-Label associations.
- **Filter_Service**: The subsystem of the API_Server responsible for Filter definitions and Filter query evaluation.
- **Reminder_Service**: The subsystem of the API_Server responsible for scheduling and delivering Reminders.
- **Sync_Service**: The subsystem of the API_Server responsible for pushing state changes to connected Web_Client sessions.
- **Search_Service**: The subsystem of the API_Server responsible for returning entities matching a free-text query.
- **Date_Parser**: The component that converts a natural-language date string (e.g., "tomorrow 5pm", "every Monday") into a structured Due_Date value.
- **Date_Printer**: The component that formats a structured Due_Date value back into a canonical natural-language string.
- **Recurrence_Engine**: The component that, given a Task with a Recurrence_Rule, computes the next occurrence strictly after a given date.
- **Filter_Parser**: The component that converts a Filter query string into a structured filter expression (abstract syntax tree).
- **Filter_Printer**: The component that formats a structured filter expression back into a canonical Filter query string.
- **User**: An authenticated account holder of the System.
- **Guest**: An unauthenticated visitor to the Web_Client.
- **Session**: An authenticated context between a Web_Client and the API_Server, identified by a session token with an expiration time.
- **Task**: A unit of work owned by a User, with a title, optional description, optional Due_Date, optional Priority, optional Project, optional Section, optional parent Task, optional Labels, optional assignee, and a completion state.
- **Subtask**: A Task whose parent_task_id references another Task.
- **Project**: A named container that groups Tasks, owned by a User, optionally shared with Collaborators, optionally nested under a parent Project.
- **Inbox**: The default Project automatically created for each User; Tasks created without a specified Project are placed here.
- **Section**: A named ordered subdivision inside a Project that groups Tasks.
- **Label**: A user-defined tag that can be applied to zero or more Tasks owned by the same User.
- **Filter**: A saved query over Tasks using a defined filter grammar (e.g., `today & p1`, `@work`, `#Inbox`).
- **Priority**: An integer in the range 1 to 4, where 1 is the highest priority and 4 is the default (no priority).
- **Due_Date**: A calendar date, optionally with a time component and optionally with a Recurrence_Rule, associated with a Task.
- **Recurrence_Rule**: A specification of how a Task repeats (e.g., every day, every Monday, every 3 days, every month on the 1st).
- **Reminder**: A scheduled notification tied to a Task's Due_Date.
- **Comment**: A text note authored by a User attached to a Task.
- **Collaborator**: A User who has been granted access to another User's shared Project.
- **Today_View**: A built-in view listing all incomplete Tasks owned by or shared with the User whose Due_Date is on or before the User's current local date.
- **Upcoming_View**: A built-in view listing incomplete Tasks owned by or shared with the User whose Due_Date falls within a rolling window of future dates grouped by day.
- **Activity_Log**: The append-only record of create, update, complete, uncomplete, and delete events on Tasks, Projects, and Sections.

## Requirements

### Requirement 1: Account Registration

**User Story:** As a Guest, I want to create an account using an email and password, so that I can access and persist my tasks.

#### Acceptance Criteria

1. WHEN a Guest submits a registration request with a well-formed email address not already associated with an existing User, a password of at least 8 characters, and a display name of 1 to 50 characters, THE Auth_Service SHALL create a new User record and return a session token.
2. IF a Guest submits a registration request with an email address already associated with an existing User, THEN THE Auth_Service SHALL reject the request with an error code indicating the email is already in use.
3. IF a Guest submits a registration request with a password shorter than 8 characters, THEN THE Auth_Service SHALL reject the request with an error code indicating the password is too short.
4. IF a Guest submits a registration request with an email address that does not match RFC 5322 syntax, THEN THE Auth_Service SHALL reject the request with an error code indicating the email is invalid.
5. IF a Guest submits a registration request with multiple validation errors, THEN THE Auth_Service SHALL return all applicable validation errors in a single response.
6. WHEN the Auth_Service creates a new User record, THE Auth_Service SHALL store the password only as a salted bcrypt hash with a cost factor of at least 12.
7. WHEN the Auth_Service creates a new User record, THE Project_Service SHALL create an Inbox Project owned by that User.

### Requirement 2: Account Login and Session Management

**User Story:** As a User, I want to log in and stay logged in across page reloads, so that I can control access to my data across devices and sessions without re-authenticating on every visit.

#### Acceptance Criteria

1. WHEN a Guest submits a login request with an email and password matching an existing User, THE Auth_Service SHALL issue a session token with an expiration of at least 7 days.
2. IF a Guest submits a login request with an email that does not match any User, THEN THE Auth_Service SHALL reject the request with an error code indicating invalid credentials, without disclosing whether the email exists.
3. IF a Guest submits a login request with a valid email and a non-matching password, THEN THE Auth_Service SHALL reject the request with an error code indicating invalid credentials, without disclosing whether the email exists.
4. IF a Guest submits more than 10 failed login attempts for the same email within 15 minutes, THEN THE Auth_Service SHALL reject subsequent login attempts for that email for 15 minutes with an error code indicating rate limiting.
5. WHEN a Web_Client sends a request with an unexpired session token, THE API_Server SHALL authenticate the request as the User associated with that token.
6. IF a Web_Client sends a request with an expired or unknown session token, THEN THE API_Server SHALL reject the request with a 401 Unauthorized response.
7. WHEN a User submits a logout request with a valid session token, THE Auth_Service SHALL invalidate the session token within 5 seconds such that subsequent requests using that token are rejected.

### Requirement 3: Password Reset

**User Story:** As a User who forgot my password, I want to reset it via email, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a Guest submits a password reset initiation request with an email address, THE Auth_Service SHALL send a password reset email containing a single-use reset token to the address if and only if an account exists for that email, and SHALL return a generic success response regardless of whether an account exists.
2. THE Auth_Service SHALL expire password reset tokens 60 minutes after issuance.
3. WHEN a Guest submits a password reset completion request with a valid unexpired reset token and a new password of at least 8 characters, THE Auth_Service SHALL update the User's password hash, invalidate the reset token, and invalidate all active Sessions for the User.
4. IF a Guest submits a password reset completion request with an expired or already-used reset token, THEN THE Auth_Service SHALL reject the request with an error code indicating the token is invalid or expired.

### Requirement 4: Task Creation

**User Story:** As a User, I want to create tasks with titles, descriptions, due dates, priorities, projects, sections, and labels, so that I can capture work to be done.

#### Acceptance Criteria

1. WHEN a User submits a task creation request with a non-empty title of 1 to 500 characters, THE Task_Service SHALL create a new Task owned by the User with completion state set to false and return the created Task.
2. IF a User submits a task creation request with a title of 0 characters or more than 500 characters, THEN THE Task_Service SHALL reject the request with an error code indicating the title length is invalid.
3. WHEN a task creation request does not specify a project, THE Task_Service SHALL assign the new Task to the User's Inbox Project.
4. WHEN a task creation request includes a project_id owned by or shared with the User, THE Task_Service SHALL assign the new Task to the specified Project.
5. IF a task creation request includes a project_id that is not owned by or shared with the User, THEN THE Task_Service SHALL reject the request with an error code indicating the project is not accessible.
6. WHEN a task creation request includes a Priority value in the range 1 to 4, THE Task_Service SHALL store that Priority on the Task.
7. IF a task creation request includes a Priority value outside the range 1 to 4, THEN THE Task_Service SHALL reject the request with an error code indicating the priority is invalid.
8. WHEN a task creation request does not include a Priority value, THE Task_Service SHALL assign Priority value 4 to the Task.
9. WHEN a task creation request includes a list of label_ids, THE Task_Service SHALL associate the Task with each Label owned by the User, and SHALL reject the request if any label_id is not owned by the User.
10. IF a task creation request contains multiple validation errors, THEN THE Task_Service SHALL return all applicable validation errors in a single response.
11. IF a task creation request includes a project_id that is not accessible, THE Task_Service SHALL reject the entire request immediately without processing other fields.

### Requirement 5: Task Editing

**User Story:** As a User, I want to edit the title, description, due date, priority, project, section, and labels of existing tasks, so that I can keep my tasks accurate.

#### Acceptance Criteria

1. WHEN a User submits a task update request for a Task owned by or shared with the User with a new title of 1 to 500 characters, THE Task_Service SHALL update the Task's title.
2. WHEN a User submits a task update request for a Task owned by or shared with the User with a new description of 0 to 16000 characters, THE Task_Service SHALL update the Task's description.
3. WHEN a User submits a task update request that moves a Task to a different Project owned by or shared with the User, THE Task_Service SHALL update the Task's project_id and clear the Task's section_id.
4. WHEN a User submits a task update request that changes the Due_Date, THE Task_Service SHALL update the Task's Due_Date and SHALL reschedule any Reminders associated with the Task.
5. IF a User submits any request (read, update, or delete) for a Task that the User neither owns nor collaborates on, or for a Task that does not exist, THEN THE Task_Service SHALL reject the request with a 404 Not Found response.

### Requirement 6: Task Completion and Reopening

**User Story:** As a User, I want to mark tasks complete and undo completions, so that I can track progress without losing work.

#### Acceptance Criteria

1. WHEN a User submits a task completion request for a non-recurring Task owned by or shared with the User, THE Task_Service SHALL set the Task's completed_at timestamp to the current time and set is_completed to true.
2. WHEN a User submits a task completion request for a recurring Task owned by or shared with the User, THE Recurrence_Engine SHALL compute the next Due_Date from the Recurrence_Rule and THE Task_Service SHALL update the Task's Due_Date to the next occurrence while keeping is_completed as false.
3. WHEN a User submits a task reopen request for a completed Task owned by or shared with the User, THE Task_Service SHALL clear the completed_at timestamp and set is_completed to false.
4. WHEN a Task is marked complete, THE Task_Service SHALL also mark all of its Subtasks as complete.
5. WHEN a User submits a task completion request, THE Task_Service SHALL record a history entry containing the Task id, the User id, and the completion timestamp.

### Requirement 7: Task Deletion

**User Story:** As a User, I want to delete tasks I no longer need, so that I can keep my task lists focused.

#### Acceptance Criteria

1. WHEN a User submits a task deletion request for a Task owned by or shared with the User, THE Task_Service SHALL remove the Task and all of its Subtasks.
2. WHEN a Task is deleted, THE Reminder_Service SHALL cancel all Reminders associated with the Task.
3. WHEN a Task is deleted, THE API_Server SHALL append a "task deleted" event to the Activity_Log within 2 seconds of the deletion.
4. IF a User submits a task deletion request for a Task that the User neither owns nor collaborates on, THEN THE Task_Service SHALL reject the request with an error code indicating the Task is not accessible.

### Requirement 8: Subtasks

**User Story:** As a User, I want to break tasks into subtasks, so that I can plan multi-step work.

#### Acceptance Criteria

1. WHEN a User submits a task creation request with a parent_task_id referencing a Task owned by or shared with the User, THE Task_Service SHALL create a Subtask whose parent_task_id is the specified Task and SHALL inherit the parent's project_id and section_id.
2. THE Task_Service SHALL support Subtask nesting to a maximum depth of 5 levels below the top-level Task.
3. IF a User submits a task creation or update request that would create a Subtask at depth greater than 5, THEN THE Task_Service SHALL reject the request with an error code indicating maximum nesting depth exceeded.
4. IF a User submits a task creation or update request that would create a cycle in the parent-child relationship, THEN THE Task_Service SHALL reject the request with an error code indicating a cyclic parent reference.
5. WHEN the parent of a Subtask is moved to a different Project, THE Task_Service SHALL move all descendant Subtasks to the same Project and clear their section_ids.
6. WHEN a parent Task is deleted, THE Task_Service SHALL delete all of its Subtasks recursively.

### Requirement 9: Task Ordering

**User Story:** As a User, I want to reorder tasks within a project, section, or view, so that I can prioritize visually.

#### Acceptance Criteria

1. THE Task_Service SHALL store an order value for each Task within its containing Project or Section.
2. WHEN a User submits a reorder request specifying a Task id and a target position within its Project or Section, THE Task_Service SHALL update the Task's order value and the order values of affected sibling Tasks so that the Task appears at the requested position.
3. WHEN Tasks are listed for a Project or Section, THE Task_Service SHALL return Tasks in ascending order value.

### Requirement 10: Project Management

**User Story:** As a User, I want to create, rename, reorder, archive, and delete projects, so that I can organize tasks by area of work.

#### Acceptance Criteria

1. WHEN a User submits a project creation request with a non-empty name of 1 to 120 characters and a color identifier from the supported palette, THE Project_Service SHALL create a new Project owned by the User.
2. IF a User submits a project creation or update request with a name of 0 characters, more than 120 characters, or a name that duplicates an existing Project name for the same User, THEN THE Project_Service SHALL reject the request with an error code indicating the project name is invalid.
3. IF a User submits a project creation or update request with a color identifier not in the supported palette, THEN THE Project_Service SHALL reject the request with an error code indicating the color is invalid.
4. WHEN a User submits a project update request for a Project owned by the User, THE Project_Service SHALL update the specified fields.
5. WHEN a User submits a project archive request for a Project owned by the User, THE Project_Service SHALL set the Project's is_archived flag to true and SHALL exclude its Tasks from Today_View, Upcoming_View, and Filter results.
6. WHEN a User submits a project deletion request for a Project owned by the User, THE Project_Service SHALL remove the Project and all Sections and Tasks belonging to it.
7. IF a User submits a project deletion or rename request for the User's Inbox Project, THEN THE Project_Service SHALL reject the request with an error code indicating the Inbox cannot be deleted or renamed.
8. THE Project_Service SHALL provide each User with exactly one Inbox Project.
9. THE Project_Service SHALL support nesting Projects as children of parent Projects to a maximum depth of 4 levels.

### Requirement 11: Sections within Projects

**User Story:** As a User, I want to group tasks into sections within a project, so that I can organize larger projects.

#### Acceptance Criteria

1. WHEN a User submits a section creation request for a Project owned by or shared with the User with a non-empty name of 1 to 120 characters, THE Project_Service SHALL create a new Section in the specified Project.
2. WHEN a User submits a section reorder request specifying a section id and a target position within its Project, THE Project_Service SHALL update the order values of affected Sections.
3. WHEN a Section is deleted, THE Project_Service SHALL move all Tasks in that Section to the parent Project with section_id set to null.
4. IF a User submits a section request for a Section in a Project not owned by or shared with the User, THEN THE Project_Service SHALL reject the request with an error code indicating the Section is not accessible.
5. THE Project_Service SHALL restrict section deletion to the owner of the Project containing the Section.

### Requirement 12: Labels

**User Story:** As a User, I want to create and apply labels to tasks, so that I can categorize tasks across projects.

#### Acceptance Criteria

1. WHEN a User submits a label creation request with a non-empty name of 1 to 60 characters containing only alphanumeric characters and underscores, and a color identifier from the supported palette, THE Label_Service SHALL create a new Label owned by the User.
2. IF a User submits a label creation request with a name that matches an existing Label owned by the same User using case-insensitive comparison, THEN THE Label_Service SHALL reject the request with an error code indicating the label name is already in use.
3. IF a User submits a label creation request with a name of 0 characters, more than 60 characters, or containing characters other than alphanumeric characters and underscores, THEN THE Label_Service SHALL reject the request with an error code indicating the label name is invalid.
4. WHEN a User submits a task update request that adds a label_id owned by the User to a Task owned by or shared with the User, THE Task_Service SHALL associate the Label with the Task.
5. WHEN a User submits a label deletion request for a Label owned by the User, THE Label_Service SHALL remove the Label and SHALL remove the Label association from all Tasks within 2 seconds.

### Requirement 13: Natural-Language Date Parsing

**User Story:** As a User, I want to type due dates in natural language, so that I can schedule tasks quickly without a date picker.

#### Acceptance Criteria

1. WHEN a User submits a date string matching the Date_Parser grammar, THE Date_Parser SHALL return a structured Due_Date value with fields date, optional time, optional timezone, and optional Recurrence_Rule.
2. THE Date_Parser SHALL recognize the following absolute date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD MMM YYYY`, `MMM DD`, `MMM DD YYYY`, and `DD MMM`.
3. THE Date_Parser SHALL recognize the following relative date expressions: `today`, `tomorrow`, `yesterday`, `next <weekday>`, `in <N> days`, `in <N> weeks`, and `in <N> months`.
4. THE Date_Parser SHALL recognize weekday expressions: `<weekday>` and `next <weekday>`.
5. THE Date_Parser SHALL recognize time components in the formats `HH:MM`, `H:MM am/pm`, and `Ham/pm`.
6. THE Date_Parser SHALL recognize the following recurrence expressions: `every day`, `every <weekday>`, `every <N> days`, `every <N> weeks`, `every month`, `every month on the <N>st/nd/rd/th`, and `every year`.
7. IF a User submits a date string that does not conform to any recognized format, THEN THE Date_Parser SHALL reject the request with an error code indicating the date is not recognized and include the unrecognized substring.
8. THE Date_Printer SHALL format any structured Due_Date value produced by the Date_Parser back into a canonical natural-language string.
9. FOR ALL structured Due_Date values `d` produced by the Date_Parser, `Date_Parser(Date_Printer(d))` SHALL return a Due_Date equivalent to `d` (round-trip property).

### Requirement 14: Recurring Tasks

**User Story:** As a User, I want tasks to recur on a schedule, so that I do not have to recreate routine work.

#### Acceptance Criteria

1. WHEN a User creates or updates a Task with a Recurrence_Rule, THE Task_Service SHALL store the rule on the Task.
2. WHEN a recurring Task is completed, THE Recurrence_Engine SHALL compute the next Due_Date strictly after the Task's current Due_Date according to the Recurrence_Rule.
3. THE Recurrence_Engine SHALL support rules equivalent to: every N days, every N weeks on specified weekdays, every N months on a specified day of month, and every N years on a specified month and day, where N is an integer from 1 to 999.
4. WHERE a Recurrence_Rule is `every <weekday>`, THE Recurrence_Engine SHALL compute the next Due_Date as the first occurrence of the specified weekday strictly after the current Due_Date.
5. WHERE a Recurrence_Rule is `every <N> days`, THE Recurrence_Engine SHALL compute the next Due_Date as the current Due_Date plus N days.
6. WHERE a recurring Task includes a time component, THE Recurrence_Engine SHALL preserve the time component in the computed next Due_Date.
7. IF a Recurrence_Rule would produce a date that does not exist in a given month (e.g., 31st of February), THEN THE Recurrence_Engine SHALL use the last day of that month.
8. WHEN a User submits a request to end recurrence on a Task, THE Task_Service SHALL remove the Recurrence_Rule from the Task while preserving the current Due_Date.
9. FOR ALL Recurrence_Rules `r` and starting dates `s`, the sequence of occurrences produced by repeatedly applying the Recurrence_Engine starting from `s` SHALL be strictly monotonically increasing.

### Requirement 15: Built-In Views (Inbox, Today, Upcoming)

**User Story:** As a User, I want built-in Inbox, Today, and Upcoming views, so that I can focus on what is due now and plan ahead.

#### Acceptance Criteria

1. WHEN an authenticated User opens the Inbox view, THE Web_Client SHALL display all non-completed Tasks assigned to the User's Inbox Project ordered by manual order value ascending.
2. WHEN a User requests the Today_View, THE Task_Service SHALL return all incomplete Tasks owned by or shared with the User whose Due_Date is on or before the User's current local date, grouped into overdue and today, excluding Tasks in archived Projects.
3. WHEN a User requests the Upcoming_View for a date range of N days, where N is between 7 and 30, THE Task_Service SHALL return all incomplete Tasks owned by or shared with the User whose Due_Date falls within the range, grouped by day, excluding Tasks in archived Projects.
4. IF a User requests the Upcoming_View with a date range less than 7 or greater than 30 days, THEN THE Task_Service SHALL reject the request with an error code indicating the date range is invalid.
5. WHEN a User requests the Today_View or Upcoming_View, THE Task_Service SHALL return Tasks ordered within each group first by Priority ascending, then by order value ascending.
6. THE Task_Service SHALL compute the current local date using the User's configured time zone.
7. THE Web_Client SHALL update built-in views to reflect changes to Tasks within 2 seconds of the change being persisted by the API_Server.

### Requirement 16: Filters

**User Story:** As a User, I want to create saved filters using a query language over due dates, projects, labels, and priorities, so that I can build custom views.

#### Acceptance Criteria

1. WHEN a User submits a filter creation request with a name of 1 to 120 characters and a query string conforming to the Filter_Parser grammar, THE Filter_Service SHALL create a new Filter owned by the User.
2. WHEN a User submits a filter query string that matches the Filter_Parser grammar, THE Filter_Parser SHALL return a structured filter expression.
3. IF a User submits a filter creation or update request with a query string that does not conform to the Filter_Parser grammar, THEN THE Filter_Service SHALL reject the request with an error code indicating a parse error, including the position of the first unexpected token.
4. THE Filter_Parser SHALL support the operators `&` (logical and), `|` (logical or), `!` (logical not), and parentheses for grouping.
5. THE Filter_Parser SHALL support operands of the forms `#project_name`, `@label_name`, `p1`, `p2`, `p3`, `p4`, `today`, `overdue`, `no date`, `due: <date>`, `due before: <date>`, `due after: <date>`, `assigned to: me`, `assigned to: <user>`, and free-text terms.
6. THE Filter_Printer SHALL format any structured filter expression produced by the Filter_Parser back into a canonical Filter query string.
7. FOR ALL structured filter expressions `e` produced by the Filter_Parser, `Filter_Parser(Filter_Printer(e))` SHALL return an expression equal to `e` (round-trip property).
8. WHEN a User runs a saved Filter owned by the User, THE Filter_Service SHALL return the set of Tasks owned by or shared with the User that satisfy the structured filter expression.

### Requirement 17: Search

**User Story:** As a User, I want to search my tasks, projects, and labels by text, so that I can find items quickly.

#### Acceptance Criteria

1. WHEN an authenticated User submits a search request with a query string of 2 to 200 characters, THE Search_Service SHALL return all non-deleted Tasks, Projects, and Labels owned by or shared with the User whose names, titles, or descriptions contain the query string using case-insensitive substring matching.
2. THE Search_Service SHALL return results grouped by entity type in the order Tasks, Projects, Labels.
3. THE Search_Service SHALL return at most 50 results per entity type per search request, ordered by most recently updated first.
4. WHEN an authenticated User submits a search query of fewer than 2 characters, THE Search_Service SHALL return an empty result list without error.
5. IF an authenticated User submits a search query of more than 200 characters, THEN THE Search_Service SHALL reject the request with an error code indicating the query length is invalid.

### Requirement 18: Reminders

**User Story:** As a User, I want reminders for tasks with due dates, so that I am notified at the right time.

#### Acceptance Criteria

1. WHEN a User creates or updates a Task with a Due_Date that includes a time component, THE Reminder_Service SHALL schedule a Reminder at the Due_Date's time for that Task.
2. WHEN an authenticated User sets a Reminder on a Task with a specific datetime, THE Reminder_Service SHALL schedule a notification for that datetime.
3. WHEN the scheduled time of a Reminder is reached, THE Reminder_Service SHALL deliver a browser push notification to each of the User's active Sessions that have granted notification permission within 60 seconds, provided the associated Task has not been deleted.
4. WHEN a User updates the Due_Date of a Task with an existing Reminder, THE Reminder_Service SHALL cancel the existing Reminder and schedule a new Reminder at the updated time if the updated Due_Date includes a time component.
5. WHEN a User completes a Task with a Reminder, THE Reminder_Service SHALL cancel the Reminder unless the Task is recurring, in which case THE Reminder_Service SHALL schedule a new Reminder for the next occurrence.
6. WHEN a Task is completed or deleted before its Reminder fires, THE Reminder_Service SHALL cancel all pending Reminders for that Task within 5 seconds; IF cancellation cannot complete within 5 seconds, THEN THE Reminder_Service SHALL fail the operation and report an error.
7. WHERE the User's notification preference is disabled, THE Reminder_Service SHALL suppress delivery of notifications for that User.
8. IF a User sets a Reminder datetime earlier than the current server time, THEN THE Reminder_Service SHALL reject the request with an error code indicating the reminder is in the past.

### Requirement 19: Task Comments

**User Story:** As a User, I want to attach comments to tasks, so that I can record context and discussion.

#### Acceptance Criteria

1. WHEN a User submits a comment creation request for a Task owned by or shared with the User with a body of 1 to 15000 characters, THE Task_Service SHALL create a new Comment associated with the Task, authored by the User, with a created_at timestamp.
2. WHEN a User submits a comment update request for a Comment authored by the User, THE Task_Service SHALL update the Comment's body and set an updated_at timestamp.
3. WHEN a User submits a comment deletion request for a Comment authored by the User or on a Task owned by the User, THE Task_Service SHALL remove the Comment.
4. IF a User submits a comment update request for a Comment not authored by the User, THEN THE Task_Service SHALL reject the request with an error code indicating the Comment is not editable by the User.

### Requirement 20: Shared Projects and Collaboration

**User Story:** As a User, I want to share projects with collaborators and assign tasks, so that I can coordinate with others.

#### Acceptance Criteria

1. WHEN a User submits a project share request for a Project owned by the User specifying an email address, THE Project_Service SHALL create a pending invitation associated with the Project and the email address and send an invitation email containing a link.
2. WHEN a User accepts a pending invitation, THE Project_Service SHALL add the User to the Project's Collaborators and SHALL grant read, create, update, and complete access to Tasks in that Project, but not delete the Project or remove other Collaborators.
3. WHEN a User with access to a shared Project submits a task assignment request specifying an assignee_user_id that is a Collaborator or owner of the Project, THE Task_Service SHALL set the Task's assignee_user_id to the specified User and include the assignee identifier in subsequent Task responses.
4. IF a User submits a task assignment request with an assignee_user_id that is not a Collaborator or owner of the Task's Project, THEN THE Task_Service SHALL reject the request with an error code indicating the assignee is not a Project member.
5. WHEN the owner of a Project submits a remove-collaborator request for a Collaborator, THE Project_Service SHALL revoke that Collaborator's access to the Project within 5 seconds and SHALL unassign any Tasks in the Project assigned to that Collaborator; IF revocation takes longer than 5 seconds due to network delays, THE Project_Service SHALL still proceed with unassigning Tasks.

### Requirement 21: Real-Time Synchronization

**User Story:** As a User, I want changes I make in one session to appear in my other open sessions and in collaborators' sessions, so that data stays consistent.

#### Acceptance Criteria

1. WHEN a User's Task, Project, Section, Label, Filter, or Comment is created, updated, or deleted by any authenticated Session, THE Sync_Service SHALL push a change event to all other active Sessions owned by the same User within 2 seconds of the change being persisted.
2. WHEN a Task in a shared Project is created, updated, or deleted, THE Sync_Service SHALL push a change event to all active Sessions of all Collaborators of that Project within 2 seconds of the change being persisted.
3. IF a Session's connection to the Sync_Service is interrupted and then re-established, THEN THE Sync_Service SHALL deliver all change events that occurred during the interruption for entities accessible to the Session's User, regardless of how long the disconnection lasted.
4. WHEN the Web_Client receives a change event from the Sync_Service, THE Web_Client SHALL update its local state to reflect the change without requiring a page reload.

### Requirement 22: Activity History

**User Story:** As a User, I want to view an activity history, so that I can see what changed and when.

#### Acceptance Criteria

1. WHEN a Task, Project, or Section is created, updated, completed, uncompleted, or deleted, THE API_Server SHALL append an event to the Activity_Log containing the actor User, event type, entity identifier, timestamp, and before/after field values for updates.
2. WHEN an authenticated User requests the Activity_Log for a Project they own or collaborate on, THE API_Server SHALL return events for that Project ordered by timestamp descending, paginated at 50 events per page; IF the User neither owns nor collaborates on the Project, THEN THE API_Server SHALL reject the request with an error code indicating the Project is not accessible.
3. THE API_Server SHALL retain Activity_Log events for at least 90 days from the event timestamp.

### Requirement 23: Gamification (Deferred)

A gamification layer (e.g., scoring, streaks, achievements) will be specified separately. Implementations should leave a stable hook on Task completion events for a future gamification subsystem to subscribe to, but no behavior is required in this version.

### Requirement 24: Keyboard Shortcuts

**User Story:** As a power user, I want keyboard shortcuts for common actions, so that I can work efficiently without a mouse.

#### Acceptance Criteria

1. WHEN a User presses the `q` key while the Web_Client is focused and no text input is active, THE Web_Client SHALL open the quick-add task dialog.
2. WHEN a User presses the `Enter` key while the quick-add task dialog is open and contains a non-empty title, THE Web_Client SHALL submit the task creation request and close the dialog.
3. WHEN a User presses the `Escape` key while the quick-add task dialog is open, THE Web_Client SHALL close the dialog without submitting.
4. WHEN a User presses the `/` key while the Web_Client is focused and no text input is active, THE Web_Client SHALL focus the global search input.
5. WHEN a User presses the `?` key while the Web_Client is focused and no text input is active, THE Web_Client SHALL display a help panel listing all available shortcuts.
6. WHEN a User has selected a Task and presses the `Enter` key, THE Web_Client SHALL open the Task for editing.
7. WHEN a User has selected a Task and presses the `Delete` key, THE Web_Client SHALL prompt for deletion confirmation.
8. WHEN a User presses the `g` key followed by the `i` key within 1 second while no text input is active, THE Web_Client SHALL navigate to the Inbox.
9. WHEN a User presses the `g` key followed by the `t` key within 1 second while no text input is active, THE Web_Client SHALL navigate to the Today_View.
10. WHEN a User presses the `g` key followed by the `u` key within 1 second while no text input is active, THE Web_Client SHALL navigate to the Upcoming_View.

### Requirement 25: User Preferences

**User Story:** As a User, I want to configure my time zone, week start day, and theme, so that the application matches my context.

#### Acceptance Criteria

1. WHEN a User submits a preferences update request specifying an IANA time zone identifier, THE API_Server SHALL update the User's time_zone preference.
2. WHEN a User submits a preferences update request specifying a week start day of `sunday` or `monday`, THE API_Server SHALL update the User's week_start preference.
3. WHEN a User submits a preferences update request specifying a theme of `light`, `dark`, or `system`, THE API_Server SHALL update the User's theme preference.
4. IF a User submits a preferences update request with a time zone identifier not in the IANA time zone database, THEN THE API_Server SHALL reject the request with an error code indicating the time zone is invalid.

### Requirement 26: Authorization

**User Story:** As a User, I want the system to enforce access control, so that my data is private and shared data is accessible only to intended parties.

#### Acceptance Criteria

1. THE API_Server SHALL require a valid session token for every request except registration, login, password reset initiation, password reset completion, and public health checks.
2. IF a request is submitted without a valid session token to an endpoint that requires authentication, THEN THE API_Server SHALL reject the request with an error code indicating authentication is required.
3. IF a User submits a request to read, update, or delete an entity that the User does not own and that is not in a Project shared with the User, THEN THE API_Server SHALL reject the request with an error code indicating the entity is not accessible.
4. WHEN the API_Server receives a request with an expired session token, THE API_Server SHALL reject the request with an error code indicating the session has expired; IF a request has both an expired token and unauthorized access, THE API_Server SHALL return whichever error is detected first during validation.

### Requirement 27: Responsive Web Interface and Browser Support

**User Story:** As a User, I want the application to work on current desktop and mobile browsers at any viewport size, so that I can use it on any device.

#### Acceptance Criteria

1. THE Web_Client SHALL render usable layouts at viewport widths from 320 pixels to 2560 pixels.
2. THE Web_Client SHALL present a single-column layout when the viewport width is below 768 pixels and a multi-column layout at or above 768 pixels.
3. WHILE the viewport width is below 768 pixels, THE Web_Client SHALL collapse the project sidebar into a toggleable drawer.
4. THE Web_Client SHALL render and function correctly on the latest two stable major versions of Chrome, Firefox, Safari, and Edge.
5. THE Web_Client SHALL provide keyboard focus indicators for all interactive elements and SHALL expose semantic roles and labels conforming to WAI-ARIA 1.2 for navigation, lists, buttons, and dialogs.
6. WHEN the Web_Client loses network connectivity, THE Web_Client SHALL display an offline indicator within 5 seconds and queue User edits for retry.
7. WHEN network connectivity is restored, THE Web_Client SHALL hide the offline indicator immediately and SHALL submit queued edits to the API_Server in the order they were made.

### Requirement 28: Performance

**User Story:** As a User, I want the app to feel fast, so that I can manage tasks without waiting.

#### Acceptance Criteria

1. WHEN an authenticated User opens the Today_View with at most 200 Tasks due, THE Web_Client SHALL render the view within 1000 milliseconds measured from navigation start on a reference laptop with a 10 Mbps connection.
2. WHEN an authenticated User creates, edits, completes, or deletes a Task, THE Web_Client SHALL reflect the change in the UI within 100 milliseconds via optimistic update.
3. IF an optimistic update fails on the API_Server, THEN THE Web_Client SHALL revert the UI to the pre-update state and display an error message within 2000 milliseconds of receiving the API error; any delay exceeding 2000 milliseconds violates this requirement.
