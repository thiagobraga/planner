# Sidebar collection folding - Plan

## Goal

Improve the sidebar collection tree so nested collections can be folded at any
level, the fold state follows the signed-in user across sessions, and collection
context menus use the application's selected background and font.

## Sidebar behavior

- Remove the inline hover `+` and `x` actions from collection rows.
- Keep the Collections header add button for creating root collections.
- Keep add-subcollection and delete actions available from the collection
  context menu.
- Show a right-aligned chevron only when a collection has direct children.
- Rotate the chevron to communicate expanded versus collapsed state and expose
  localized expand/collapse labels plus `aria-expanded`.
- Allow every collection with children to be folded independently, including
  collections nested several levels deep.
- Keep a collapsed collection visible while hiding all of its descendants.
- Default collections to expanded when no saved state exists.
- If the current route targets a descendant of a collapsed collection,
  temporarily reveal its ancestor path so the active collection remains visible.
  This route-driven reveal must not overwrite the saved fold preference.

## Persisted preference and synchronization

Add `collapsedCollectionIds: string[]` to the existing user preferences
contract. Store it in PostgreSQL as a non-null UUID array with an empty-array
default in `036_preferences_collapsed_collections.sql`.

The preferences service must:

- Return `collapsedCollectionIds` from `GET /api/v1/preferences`.
- Accept it in `PATCH /api/v1/preferences`.
- Validate that the value is an array of collection UUID strings.
- Persist the complete normalized set of collapsed collection IDs.
- Continue publishing the updated preferences payload through the existing
  `preferences` sync event.

The frontend must treat the React Query `['preferences']` cache as the source of
truth. A fold toggle should optimistically update the cache, persist the new
array, reconcile with the returned preferences, and restore the prior value if
the request fails. Existing preference sync handling in `AppShell` will apply
updates received from other sessions.

Ignore IDs that are no longer present when deriving the rendered tree. The next
user fold mutation should persist the normalized set, preventing deleted
collection IDs from accumulating without requiring a write during initial load.

## Tree and drag behavior

Keep the complete flattened collection tree available for hierarchy and parent
lookups, then derive a visible flattened list by recursively excluding the
descendants of collapsed nodes. Use the visible list for rendering and the
`SortableContext` while preserving the hidden descendants' parent relationships
and sibling ordering during drag operations.

The chevron is a separate button and must not navigate to the collection or
start a drag. Navigating via the collection label and dragging via the existing
dot handle remain unchanged.

## Context menu appearance

`ContextMenu` currently portals to `document.body`, hardcodes `font-journal`,
and uses fixed cream/hover colors, so it sits outside the font class and theme
tokens on `.app-shell`.

Portal context menus beneath the active app shell when it exists, with
`document.body` retained only as a non-app/test fallback. Remove the hardcoded
font utility and let the menu inherit the shell font. Add or reuse shell-level
overlay background and hover tokens so beige and white backgrounds produce a
matching menu surface while preserving the existing border, destructive color,
keyboard behavior, positioning, and submenu behavior.

## Public interface changes

```typescript
interface Preferences {
  // Existing fields...
  collapsedCollectionIds: string[];
}
```

`PATCH /api/v1/preferences` accepts the same field as an optional partial
update. No new endpoint or collection mutation event is required.

## Verification

- API service and route tests cover default formatting, valid persistence,
  invalid payload rejection, and the emitted preference sync payload.
- Collection tree tests cover chevron visibility, arbitrary-depth folding,
  independent branches, active-descendant reveal, removal of inline row
  actions, optimistic persistence, rollback, and incoming synchronized state.
- Context menu tests verify that the portal mounts under `.app-shell`, no longer
  forces Lora, and uses application theme tokens.
- Run focused tests first, followed by API and app lint, tests, and builds.
- Verify in the running browser with nested collections: fold multiple levels,
  reload, confirm persistence, confirm another active session receives the
  update, navigate directly to a hidden descendant, and inspect the context menu
  under every available font and both beige and white backgrounds.

## Out of scope

- Removing add-subcollection or delete from the collection context menu.
- Changing collection hierarchy limits, collection CRUD semantics, or the
  Collections page actions.
- Persisting fold state in `localStorage`.

