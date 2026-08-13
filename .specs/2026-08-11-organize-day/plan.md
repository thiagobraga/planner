# Organize Day + Inline Upcoming — Plan

## Context

The Daily page (`DailyPage.tsx`) currently shows overdue + today tasks in reverse-date sections.
When tasks pile up (≥8 open tasks across overdue + today), the user has no way to redistribute them
across future days without manually editing each one. The Upcoming page (`UpcomingPage.tsx`) exists
as a separate route but only renders mock seed data — it's not wired to the API.

This feature adds two interconnected behaviours directly to the Daily page — no new routes needed.

### Scope decisions

| # | Decision |
|---|---|
| 1 | **Inline Upcoming on Daily** — toggled by a header button, fetches `/views/upcoming?days=7` and renders future-day sections *above* today. Not a separate page. |
| 2 | **Reorganize** — client-side algorithm distributes ≤5 root tasks per day starting from today, spilling into successive future days. Visual preview only until confirmed. |
| 3 | **Batch endpoint** — `POST /tasks/reorganize` accepts `{ moves: [{ taskId, dueDate }] }`, updates all dates in one transaction. One request, not N individual PATCHes. |
| 4 | **Subtasks follow parent** — moving a root task propagates `due_date` to its children, matching `moveTask` behaviour. Subtasks don't count toward the 5-per-day cap. |
| 5 | **Notes excluded** — only `type: 'task'` rows are candidates for redistribution. |
| 6 | **No persistence until confirmed** — "No" reverts to the original state with zero API calls. "Yes" persists the batch. |

### Header layout

```
[Reorganize] [Upcoming] [Today] [✓] [📝]
```

When in preview state, `[Reorganize]` is replaced by `Confirm? Yes · No`.

---

## Backend

### `POST /api/v1/tasks/reorganize` — `api/src/routes/reorganize.ts` (new)

A batch endpoint for atomic multi-task date reassignment. The existing `PATCH /tasks/:id/move`
handles one task at a time with full tree repositioning (parent, section, scope ordering). For
reorganize, we only change `due_date` on multiple root tasks — N individual moves would be slow and
generate N sync events.

```ts
// Body: { moves: [{ taskId: string, dueDate: string }] }
// Validation: non-empty, max 100, ISO date format, all tasks uncompleted, all root (no parent)
// Transaction: BEGIN → verify ownership + lock FOR UPDATE → update each root + descendants → COMMIT
// Sync: publishEvent per moved task (entityType: 'task', eventType: 'updated')
// Response: { updated: number }
```

Route must be registered **before** `/tasks/:id` in `routes/index.ts` to avoid Express treating
`reorganize` as a task ID parameter.

---

## Frontend

### API bindings — `app/src/api/client.ts` (extend)

```ts
export interface ReorganizeMove { taskId: string; dueDate: string }
export async function apiReorganizeTasks(moves: ReorganizeMove[]): Promise<{ updated: number }>
```

### `useReorganize` hook — `app/src/hooks/useReorganize.ts` (new)

State machine: `idle → preview → persisting → idle`.

- **`showButton`** — `true` when ≥8 uncompleted root tasks (`type: 'task'`, no `parentTaskId`) exist
  across today+overdue sections.
- **`startPreview()`** — gathers eligible tasks in date+order sequence, distributes ≤5 per day
  starting today, builds preview sections with tasks reassigned to new dates, calls `onPreview`.
  Also auto-enables Upcoming to show the future days.
- **`confirmReorganize()`** — fires `apiReorganizeTasks(moves)`, then refetches.
- **`cancelReorganize()`** — reverts sections from the saved snapshot with no API call.

The redistribution algorithm:
1. Collect all uncompleted root tasks from sections with `key ≤ todayKey`, sorted by existing
   section order (overdue dates first, preserving relative order within each).
2. Walk the collected tasks. Every 5 tasks, increment the day offset.
3. Record `{ taskId, dueDate }` moves only where the date actually changes.

### `DailyPage.tsx` (modify)

**Upcoming toggle:** New `showUpcoming` state. When on, fetches `fetchUpcomingTasks()` and renders
future-day sections above the today/overdue sections. Each section label uses `dayLabel()` and
annotates tomorrow with `· TOMORROW` / `· AMANHÃ`. Upcoming sections are read-only previews (no
inline task creation, no drag-and-drop).

**Reorganize integration:** Wire `useReorganize` into the existing sections state. The hook's
`onPreview` callback replaces `sections` with the redistributed version, and `onRevert` restores
from the pre-preview snapshot. When previewing, the Upcoming toggle is forced on to show the
overflow days.

**Header toolbar update:**

```tsx
<div className="page-header-toolbar ...">
  {reorgState === 'preview' ? (
    <span className="reorganize-confirm">
      {t('reorganize.confirm')}
      <button onClick={confirmReorganize}>{t('common.yes')}</button>
      <span>·</span>
      <button onClick={cancelReorganize}>{t('common.no')}</button>
    </span>
  ) : showReorganize && (
    <Button variant="secondary" size="sm" onClick={startPreview}>
      {t('reorganize.button')}
    </Button>
  )}

  <Button variant={showUpcoming ? 'primary' : 'secondary'} size="sm"
    onClick={() => setShowUpcoming(v => !v)}>
    {t('page.upcoming')}
  </Button>

  <Button variant="secondary" size="sm" onClick={handleToday}>
    {t('page.today')}
  </Button>
  <TaskVisibilityControls ... />
</div>
```

**Render order:**
1. Upcoming sections (future → nearest) — only when `showUpcoming` is true
2. Existing today + overdue sections (unchanged logic)

### i18n — `en.ts` + `pt-BR.ts` (extend)

```
reorganize.button    'Reorganize'    / 'Reorganizar'
reorganize.confirm   'Confirm?'      / 'Confirmar?'
common.yes           'Yes'           / 'Sim'
common.no            'No'            / 'Não'
```

### Styling — `index.css` (extend)

Minimal additions for the inline confirmation prompt: `display: inline-flex`, gap, underlined
link-style buttons (`text-decoration: underline`, `text-underline-offset: 2px`), inheriting Lora
from `--font-family`. No new colours, no shadows — stays within DESIGN.md.

---

## Risks / mitigations

- **Preview drift** — if a sync event arrives while the user is reviewing the preview (another tab
  creates a task), the preview becomes stale. Mitigation: cancel the preview on any incoming task
  sync event and show a brief toast.
- **Large reorganize** — 100 tasks × subtrees could be many DB writes. The endpoint caps at 100
  moves and uses a single transaction with `FOR UPDATE` locks.
- **Upcoming API not wired** — `fetchUpcomingTasks` exists in `client.ts` but `UpcomingPage.tsx`
  never calls it (uses mock data). The inline upcoming toggle will be the first real consumer.

---

## Follow-up: remove standalone Upcoming page (2026-08-13)

`UpcomingPage.tsx` was dead code — never routed in `App.tsx`, only rendered mock seed data. The
inline Upcoming toggle on `DailyPage` (above) is the sole "Upcoming" surface now.

- Deleted `app/src/pages/UpcomingPage.tsx` and its test.
- Kept `fetchUpcomingTasks` (`client.ts`), `['upcoming']` query-key invalidations (`AppShell.tsx`),
  and the `page.upcoming` i18n key — all reused by the inline toggle.
- `g u` hotkey kept, repurposed: was `navigate:upcoming` (dead route), now `toggle:upcoming`.
  Dispatches a `toggle-upcoming` `CustomEvent` (same pattern as `task-created`); `AppShell`
  navigates to `/daily` first if elsewhere, `DailyPage` listens and flips `showUpcoming` (fetching
  on enable, same as clicking the button).
- Help dialog copy (`helpContent.ts`, en + pt-BR) updated to describe Upcoming as a Daily-page
  toggle, not a destination page.

---

## Verification

```bash
docker compose exec api npm run build && docker compose exec api npm run lint
docker compose exec app npm run build && docker compose exec app npm run lint
docker compose exec api npm test && docker compose exec app npm test
```

**Automated tests:**
- `api/src/routes/__tests__/reorganize.test.ts` — happy path (10 tasks → 5+5), subtask
  propagation, auth guard (401/404), validation (empty, bad dates, subtasks rejected), transaction
  rollback.
- `app/src/hooks/__tests__/useReorganize.test.ts` — threshold detection (7 tasks=hidden, 8=shown),
  redistribution algorithm, state transitions (idle→preview→persisting→idle), cancel reverts.
- `app/src/pages/__tests__/DailyPage.test.tsx` (extend) — Upcoming toggle renders future sections,
  reorganize preview/confirm/cancel flow.

**Manual, in the browser:**
1. Create 10+ tasks with today/past due dates → "Reorganize" button appears.
2. Click Reorganize → tasks redistribute visually, upcoming sections appear above.
3. Click "No" → original layout restores instantly.
4. Click Reorganize again → "Yes" → tasks persist to new dates.
5. Reload → tasks remain on their new dates.
6. With <8 tasks → Reorganize button hidden.
7. Toggle "Upcoming" independently → future tasks appear/disappear.
