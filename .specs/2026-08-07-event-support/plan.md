# Event Support & Hotkey Fixes — Plan

## Context

Planner currently supports two task types: `task` (rendered with `•` bullet) and `note` (rendered with `-` dash). Following the Bullet Journal (BuJo) methodology, we need to add a third type: **event**, rendered with `○` (open circle).

The BuJo rapid-logging convention uses these signifiers:

| Symbol | Type  | Current Status |
|--------|-------|----------------|
| `*`    | Task  | ✅ Works inline (TaskItem) |
| `-`    | Note  | ✅ Works inline (TaskItem) |
| `(`    | Event | ❌ New — creates a circle like BuJo events |

Additionally, two issues must be fixed:
1. **QuickAdd doesn't support prefixes** — typing `* `, `- `, or `( ` in the QuickAdd dialog has no effect; only inline editing in `TaskItem.tsx` handles conversion markers.
2. **Mobile virtual keyboards break conversion** — the current implementation relies on `keydown` events for individual characters, but mobile virtual keyboards often fire `keydown` with `key: 'Unidentified'` or skip the event entirely for special characters like `-`, `*`, `(`.

### Current Implementation (reference)

**Conversion markers** in [`TaskItem.tsx`](file:///p/projects/planner/app/src/components/TaskItem.tsx) (L111–116):
```typescript
const CONVERSION_MARKERS: Record<string, Task['type']> = {
  '-': 'note',
  '[': 'task',
  ']': 'task',
  '*': 'task',
};
```

Handled in `handleEditKeyDown` (L227–247) — fires on `keydown`, checks if title is empty and the pressed key matches a marker, then calls `onConvertType(task.id, type)`.

**QuickAdd** ([`QuickAdd.tsx`](file:///p/projects/planner/app/src/components/QuickAdd.tsx)) extracts natural-language dates but passes no `type` parameter. The API defaults to `'task'`.

**Database** ([`020_task_type.sql`](file:///p/projects/planner/api/src/db/migrations/020_task_type.sql)): `type VARCHAR(10) NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'note'))`.

---

## Backend

### Migration `036_task_type_event.sql`

Widen the CHECK constraint to include `'event'`:

```sql
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN ('task', 'note', 'event'));
```

### Service Changes

#### `taskValidation.ts`
Update the valid types constant (currently checks `type IN ['task', 'note']`) to include `'event'`.

#### `taskService.ts`
No structural changes needed — the service already passes `type` through to the DB. The validation utility handles the constraint. Ensure:
- `createTask` — `'event'` passes validation
- `updateTask` — `'event'` passes validation
- `completeTask` — recurring event clones preserve `type: 'event'`

### No new routes needed
Existing `POST /tasks`, `PATCH /tasks/:id` already accept `type` in the request body.

---

## Frontend

### TaskItem.tsx Changes

#### 1. Add `'('` conversion marker

```diff
 const CONVERSION_MARKERS: Record<string, Task['type']> = {
   '-': 'note',
   '[': 'task',
   ']': 'task',
   '*': 'task',
+  '(': 'event',
 };
```

#### 2. Add event indicator rendering

Events render with an `○` (open circle) indicator, matching the BuJo convention. The circle is **non-clickable** (like notes — events are informational markers, not toggleable checkboxes):

```tsx
{task.type === 'event' && (
  <span className="task-item-event-indicator ...">○</span>
)}
```

Style: same dimensions and positioning as the note `-` indicator, using `--color-ink`.

#### 3. Mobile-safe conversion (input event fallback)

Add an `onChange` / `onInput` handler as a fallback for mobile keyboards:

```typescript
function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
  const value = e.target.value;
  // Check if user typed a conversion marker followed by space (or just the marker)
  const match = value.match(/^([-*(\[\]])(\s|$)/);
  if (match && CONVERSION_MARKERS[match[1]]) {
    onConvertType(task.id, CONVERSION_MARKERS[match[1]]);
    // Clear the marker from the input
    setEditTitle(value.slice(match[0].length));
    return;
  }
  setEditTitle(value);
}
```

Keep the existing `keydown` handler for desktop — it provides better UX with immediate response before the character is inserted.

### QuickAdd.tsx Changes

Add prefix detection in `handleSubmit` before sending to the API:

```typescript
function handleSubmit() {
  let trimmed = title.trim();
  let type: 'task' | 'note' | 'event' = 'task';

  // BuJo prefix detection
  const prefixMatch = trimmed.match(/^([-*(])\s+(.+)/);
  if (prefixMatch) {
    const marker = prefixMatch[1];
    if (marker === '-') type = 'note';
    else if (marker === '(') type = 'event';
    // '*' stays as 'task' (default)
    trimmed = prefixMatch[2];
  }

  const { date, recurrenceRule, cleanTitle } = extractNaturalDate(trimmed, ...);
  onSubmit({ title: cleanTitle, dueDate: date, recurrenceRule, type });
}
```

Update `onSubmit` prop type and `apiCreateTask` call to pass `type`.

### CSS

```css
.task-item-event-indicator {
  /* Same dimensions as .task-item-note-indicator */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  color: var(--color-ink);
  flex-shrink: 0;
  cursor: default;
}
```

---

## Testing

### Backend
- [ ] Unit test: `taskValidation` accepts `'event'` as valid type
- [ ] Unit test: `taskService.createTask` with `type: 'event'` succeeds
- [ ] Unit test: `taskService.updateTask` changing type to `'event'` succeeds
- [ ] Unit test: `taskService.completeTask` on recurring event preserves `type: 'event'`
- [ ] Property test (fast-check): all three types round-trip through create → fetch

### Frontend
- [ ] Unit test: `TaskItem` renders `○` indicator for event type
- [ ] Unit test: `TaskItem` conversion markers include `(` → `'event'`
- [ ] Unit test: QuickAdd strips `( ` prefix and sets type to `'event'`
- [ ] Unit test: QuickAdd strips `- ` prefix and sets type to `'note'`
- [ ] Unit test: QuickAdd strips `* ` prefix and keeps type as `'task'`
- [ ] Unit test: Mobile `onChange` fallback triggers conversion

---

## Manual Verification

1. **Inline conversion (desktop)**: Empty task title → type `(` → converts to event with `○`
2. **Inline conversion (mobile)**: Same flow on mobile browser/PWA
3. **QuickAdd**: Type `( Team standup tomorrow` → creates event titled "Team standup tomorrow" with tomorrow's date
4. **QuickAdd notes**: `- Shopping list` → creates note
5. **QuickAdd tasks**: `* Buy groceries` → creates task
6. **Event rendering**: Events display `○` indicator in Daily, Inbox, Collection views
7. **Event completion**: Complete an event → shows `×` like tasks
8. **Recurring events**: Complete a recurring event → new instance is also type `event`
