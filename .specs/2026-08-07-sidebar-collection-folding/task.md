# Sidebar collection folding - Tasks

Source plan: `plan.md`.

## Specification setup

- [x] Re-read `plan.md` and inspect the latest worktree state before editing
- [x] Confirm migration numbering is still available before adding migration 036
- [x] Mark each task `[~]` when started and `[x]` only after verification

## Preferences persistence and sync

- [x] Add `036_preferences_collapsed_collections.sql` with a non-null UUID-array
      `collapsed_collection_ids` column defaulting to an empty array
- [x] Extend the API preferences row/input/output types with
      `collapsedCollectionIds`
- [x] Validate that preference updates contain only an array of UUID strings
- [x] Persist `collapsedCollectionIds` in `updatePreferences()` and include it in
      the returned object and existing realtime preference event payload
- [x] Extend API service tests for formatting, validation, update SQL, and sync
      publication
- [x] Extend preferences route tests for the new GET/PATCH response field
- [x] Extend the frontend `Preferences` contract and affected preference fixtures

## Recursive sidebar folding

- [x] Separate the complete flattened collection tree from the recursively
      filtered visible rows
- [x] Derive child presence for each collection and render a right-aligned
      chevron only for nodes with children
- [x] Add localized expand/collapse labels and `aria-expanded`
- [x] Ensure the fold button neither navigates nor activates collection drag
- [x] Hide every descendant of a collapsed node at arbitrary nesting depth
- [x] Keep separate branches independently foldable
- [x] Temporarily reveal collapsed ancestors of the active collection without
      changing the saved preference
- [x] Use visible rows in `SortableContext` while preserving hidden descendant
      hierarchy and ordering during collection drag operations

## Preference interaction

- [x] Read fold state from the React Query `['preferences']` cache
- [x] Normalize saved IDs against current collections when deriving visible rows
- [x] Optimistically update the cache when a chevron is toggled
- [x] Persist the complete normalized `collapsedCollectionIds` array
- [x] Reconcile successful responses and roll back the previous preference after
      a failed update
- [x] Confirm existing `preferences` sync events immediately update the rendered
      fold state in other active sessions

## Sidebar row cleanup

- [x] Remove the inline hover add-subcollection button from collection rows
- [x] Remove the inline hover delete button from collection rows
- [x] Remove obsolete row props and `.collection-row__action` CSS
- [x] Keep root creation in the Collections header
- [x] Keep change color, rename, add subcollection, and delete in the context menu

## Context menu theme and font

- [x] Portal `ContextMenu` beneath `.app-shell`, retaining a body fallback for
      tests or non-shell rendering
- [x] Remove the hardcoded `font-journal` class so the selected font is inherited
- [x] Replace fixed panel and highlighted-row colors with shell-level overlay
      theme tokens for beige and white backgrounds
- [x] Preserve viewport positioning, keyboard navigation, submenus, separators,
      destructive styling, and close behavior

## Automated tests

- [x] Add collection-tree tests for chevron presence and expanded/collapsed state
- [x] Add tests for nested and independent branch folding
- [x] Add a test for active-descendant ancestor reveal without preference mutation
- [x] Add tests proving inline add/delete buttons are absent while context-menu
      actions remain
- [x] Add preference mutation tests for optimistic success and failure rollback
- [x] Add a sync regression test for an incoming `collapsedCollectionIds` update
- [x] Add context-menu tests for app-shell portal placement, inherited font, and
      theme-token classes
- [x] Run focused API and app Vitest suites for all changed behavior

## Full verification

- [x] Run API lint, tests, and build
- [x] Run app lint, tests, and build
- [x] Start the isolated Planner stack and verify nested folding in a browser
- [x] Reload and confirm account-persisted fold state
- [x] Confirm fold changes synchronize to another active session
- [x] Navigate directly to a hidden descendant and confirm its path is revealed
- [x] Verify context menus with Lora, Playpen Sans, and Hubballi
- [x] Verify context menus with beige and white backgrounds
- [x] Capture screenshots for delivery without committing them
- [x] Review the final diff and confirm unrelated worktree changes are untouched
