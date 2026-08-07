# Sidebar collection folding - Tasks

Source plan: `plan.md`.

## Specification setup

- [ ] Re-read `plan.md` and inspect the latest worktree state before editing
- [ ] Confirm migration numbering is still available before adding migration 036
- [ ] Mark each task `[~]` when started and `[x]` only after verification

## Preferences persistence and sync

- [ ] Add `036_preferences_collapsed_collections.sql` with a non-null UUID-array
      `collapsed_collection_ids` column defaulting to an empty array
- [ ] Extend the API preferences row/input/output types with
      `collapsedCollectionIds`
- [ ] Validate that preference updates contain only an array of UUID strings
- [ ] Persist `collapsedCollectionIds` in `updatePreferences()` and include it in
      the returned object and existing realtime preference event payload
- [ ] Extend API service tests for formatting, validation, update SQL, and sync
      publication
- [ ] Extend preferences route tests for the new GET/PATCH response field
- [ ] Extend the frontend `Preferences` contract and affected preference fixtures

## Recursive sidebar folding

- [ ] Separate the complete flattened collection tree from the recursively
      filtered visible rows
- [ ] Derive child presence for each collection and render a right-aligned
      chevron only for nodes with children
- [ ] Add localized expand/collapse labels and `aria-expanded`
- [ ] Ensure the fold button neither navigates nor activates collection drag
- [ ] Hide every descendant of a collapsed node at arbitrary nesting depth
- [ ] Keep separate branches independently foldable
- [ ] Temporarily reveal collapsed ancestors of the active collection without
      changing the saved preference
- [ ] Use visible rows in `SortableContext` while preserving hidden descendant
      hierarchy and ordering during collection drag operations

## Preference interaction

- [ ] Read fold state from the React Query `['preferences']` cache
- [ ] Normalize saved IDs against current collections when deriving visible rows
- [ ] Optimistically update the cache when a chevron is toggled
- [ ] Persist the complete normalized `collapsedCollectionIds` array
- [ ] Reconcile successful responses and roll back the previous preference after
      a failed update
- [ ] Confirm existing `preferences` sync events immediately update the rendered
      fold state in other active sessions

## Sidebar row cleanup

- [ ] Remove the inline hover add-subcollection button from collection rows
- [ ] Remove the inline hover delete button from collection rows
- [ ] Remove obsolete row props and `.collection-row__action` CSS
- [ ] Keep root creation in the Collections header
- [ ] Keep change color, rename, add subcollection, and delete in the context menu

## Context menu theme and font

- [ ] Portal `ContextMenu` beneath `.app-shell`, retaining a body fallback for
      tests or non-shell rendering
- [ ] Remove the hardcoded `font-journal` class so the selected font is inherited
- [ ] Replace fixed panel and highlighted-row colors with shell-level overlay
      theme tokens for beige and white backgrounds
- [ ] Preserve viewport positioning, keyboard navigation, submenus, separators,
      destructive styling, and close behavior

## Automated tests

- [ ] Add collection-tree tests for chevron presence and expanded/collapsed state
- [ ] Add tests for nested and independent branch folding
- [ ] Add a test for active-descendant ancestor reveal without preference mutation
- [ ] Add tests proving inline add/delete buttons are absent while context-menu
      actions remain
- [ ] Add preference mutation tests for optimistic success and failure rollback
- [ ] Add a sync regression test for an incoming `collapsedCollectionIds` update
- [ ] Add context-menu tests for app-shell portal placement, inherited font, and
      theme-token classes
- [ ] Run focused API and app Vitest suites for all changed behavior

## Full verification

- [ ] Run API lint, tests, and build
- [ ] Run app lint, tests, and build
- [ ] Start the isolated Planner stack and verify nested folding in a browser
- [ ] Reload and confirm account-persisted fold state
- [ ] Confirm fold changes synchronize to another active session
- [ ] Navigate directly to a hidden descendant and confirm its path is revealed
- [ ] Verify context menus with Lora, Playpen Sans, and Hubballi
- [ ] Verify context menus with beige and white backgrounds
- [ ] Capture screenshots for delivery without committing them
- [ ] Review the final diff and confirm unrelated worktree changes are untouched

