# Cross-Tab Sync — Manual Test Checklist

**Setup:** Open two browser windows side-by-side, both logged in as the same user, both on `/inbox`. Watch the sync status dot (bottom-right, dev-only) — it must be green before testing.

All changes from Tab 1 must appear in Tab 2 within 2 seconds without any manual refresh.

---

## Create

- [x] In Tab 1, type a task title in the "Add task…" input and press Enter
- [x] Verify the task appears in Tab 2 within 2 seconds

## Edit (title)

- [x] In Tab 1, open a task for editing (Shift+Enter or double-click), change the title, press Enter to commit
- [x] Verify the updated title appears in Tab 2 within 2 seconds

## Complete

- [x] In Tab 1, click the bullet/circle toggle on a task to mark it complete
- [x] Verify the task appears completed (strikethrough, dimmed) in Tab 2 within 2 seconds

## Reopen (uncomplete)

- [x] In Tab 1, click the toggle on a completed task to reopen it
- [x] Verify the task returns to active state in Tab 2 within 2 seconds

## Delete

- [x] In Tab 1, select a task and press Delete (or Backspace in edit mode on an empty input)
- [x] Verify the task disappears from Tab 2 within 2 seconds

---

## Bidirectional check

- [x] Repeat the **Create** and **Delete** steps with Tab 2 as the source — verify Tab 1 updates.

---

## Failure indicators

- Changes appear in Tab 1 but not Tab 2 → check browser console for `[sync] event` logs; if absent, Redis pub/sub may be down
- Changes appear after >2 seconds → acceptable only under heavy load; otherwise check Redis latency
