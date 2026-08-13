# Undo/Redo Action History — Tasks

## Backend

- [ ] Create `api/src/db/migrations/040_history_entries.sql` — `history_entries` table + sequence
      (follow `db-migration` skill conventions; confirm exact next-free number against `main` at
      implementation time)
- [ ] Add `history_depth` column to `preferences` (same or follow-up migration), default `15`
- [ ] Create `api/src/services/historyService.ts` — `record()`, `undo()`, `redo()`, ring-buffer
      eviction, redo-stack invalidation on fresh push
- [ ] Add `'history'` to `SyncEntityType` in `syncService.ts`; reuse existing `SyncEventType`
      values per-entity + `'undone'|'redone'` for the meta-event
- [ ] Wire `historyService.record()` into `taskService.ts`: `createTask`, `updateTask`,
      `deleteTask`, `completeTask`, `reopenTask`, `moveTask`, `reorderTask`, `reorganizeTasks`
      (one entry per moved task, shared `batchId`)
- [ ] Wire `historyService.record()` into `habitService.ts`: `toggleCompletion`, `createHabit`,
      `updateHabit`, `deleteHabit`, `moveHabit`
- [ ] Wire `historyService.record()` into `collectionService.ts`, `sectionService.ts` where
      relevant (create/update/delete/move)
- [ ] Extend `preferencesService.ts` — `historyDepth` field, `VALID_HISTORY_DEPTHS = [10,15,20]`,
      validation
- [ ] Create `api/src/routes/history.ts` — `GET /history`, `POST /history/undo`,
      `POST /history/redo`
- [ ] Register history routes in `api/src/routes/index.ts`
- [ ] Write `api/src/services/__tests__/historyService.test.ts`
- [ ] Write `api/src/routes/__tests__/history.test.ts`
- [ ] Extend existing `taskService.test.ts` / `habitService.test.ts` for new history-record calls

## Frontend

- [ ] Extend `hooks/shortcuts.ts` — add `ctrlOrCmd`/`shift` to `KeyEvent`, `modifiers` to
      `SingleBinding`, modifier-aware matching in `matchKey` (additive, backward compatible)
- [ ] Update the keydown listener call site (likely `AppShell.tsx`) to populate
      `ctrlOrCmd`/`shift` from the native `KeyboardEvent`
- [ ] Add `history:undo` / `history:redo` bindings to `DEFAULT_BINDINGS`
      (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl/Cmd+Y)
- [ ] Add `apiUndo`, `apiRedo`, `fetchHistory` to `app/src/api/client.ts`
- [ ] Create `app/src/hooks/useHistory.ts` — undo/redo actions, store patching per entity type,
      sync-event subscription for cross-tab stack updates
- [ ] Wire `history:undo`/`history:redo` shortcut dispatch in `AppShell.tsx`
- [ ] Add inline "Undo" action to the existing toast/notification component, triggered after every
      undoable mutation call site (task complete/delete/move, habit toggle, etc.)
- [ ] Coalesce batch-mutation toasts (e.g. reorganize) into a single "Undo (N items)" toast via
      shared `batchId`
- [ ] Add "History depth" control to `SettingsPage.tsx` (10/15/20), wired through
      `usePreferences.ts`
- [ ] Write `app/src/hooks/__tests__/shortcuts.test.ts` extension for modifier matching
- [ ] Write `app/src/hooks/__tests__/useHistory.test.ts`
- [ ] Extend `app/src/pages/__tests__/SettingsPage.test.tsx` for history-depth control

## i18n

- [ ] Add English keys: `history.undo`, `history.redo`, `history.undoToast`, `history.skipped`,
      `settings.historyDepth`
- [ ] Add Portuguese (`pt-BR`) equivalents

## Styling

- [ ] Style the Undo toast action button — reuse existing toast component's action-button
      pattern/tokens (no new colors/shadows; stay within `DESIGN.md`: flat, Lora, 24px rhythm)
- [ ] Style the Settings "History depth" segmented control consistent with existing Settings
      controls (theme/font selectors) on `SettingsPage.tsx`

---

### Critical files for implementation
- `api/src/services/syncService.ts`
- `api/src/services/taskService.ts`
- `api/src/services/activityService.ts` (pattern precedent — not reused directly)
- `api/src/db/migrations/015_activity_events.sql` (schema-shape precedent)
- `app/src/hooks/shortcuts.ts`
- `app/src/stores/optimistic.ts`
- `api/src/services/preferencesService.ts`
- `CLAUDE.md`
