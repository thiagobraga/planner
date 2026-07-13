# Phase 6 — Tree-Aware Indent Levels

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace flat indent model with tree-aware indentation using `parentTaskId`. When a user presses Tab/Shift+Tab on a task, the frontend computes the correct `parentTaskId` and sends it to the API, shifting descendant tasks proportionally.

## Rules

1. **Solo task** — Tab/Shift+Tab is a no-op (nothing to nest under or unnest from)
2. **First task in non-empty list** — Tab is a no-op (no preceding task at same level to become parent)
3. **Tab on any other task** — becomes child of the nearest preceding task at same or shallower indent level; sets `parentTaskId` to that task's id and `indent = parent.indent + 1`
4. **Shift+Tab on child** — promotes one level: `parentTaskId` becomes the grandparent's id (or `null` at top level), `indent` decreases by 1
5. **Indenting a parent** — all descendants shift by the same `indent` delta, preserving relative depth

## Files Changed

| File | Change |
|------|--------|
| `app/src/utils/taskTree.ts` (new) | Tree helpers: `getParentCandidate`, `getDescendants`, `computeIndent` |
| `app/src/pages/InboxPage.tsx` | Update `handleIndent` |
| `app/src/pages/DailyPage.tsx` | Update `handleIndent` |
| `app/src/pages/ProjectsPage.tsx` | Update `handleIndent` |
| `app/src/pages/UpcomingPage.tsx` | Add `handleIndent` (currently missing) |
| `app/src/pages/SearchPage.tsx` | Add `handleIndent` |
| `app/src/api/client.ts` | `apiUpdateTask` to accept `parentTaskId` |

## API contract

`PATCH /tasks/:id` body accepts optional `parent_task_id: string | null`. Backend already has the column — this just wires it through.
