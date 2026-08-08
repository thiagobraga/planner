# Collection Color Picker — Plan

## Context

Collection colors today are auto-assigned only: `nextColor()` cycles through a fixed 20-hex `PALETTE_COLORS` array on creation (`app/src/api/client.ts:426`), and `COLOR_SHADE_FAMILIES` (`CollectionTreeNav.tsx:35-87`) derives sub-collection shades from their parent at creation time and on drag-reparent. There is no UI anywhere for a user to manually pick a color. The backend already fully supports arbitrary hex/rgb(a)/hsl(a) values (`api/src/utils/color.ts` `validateColor()`, CHECK constraint added in migration `033_exact_collection_label_colors.sql`) and `updateCollection()` already patches `color` independently with no cascade side effects — so the mutation path needs zero backend changes.

The ask: a custom color picker (gradient square + hue/alpha sliders + hex/rgb/hsl input, eyedropper, saved colors, app palette) opened from a new "Alterar cor..." context-menu item (first item, sidebar rows), and the same context menu wired onto collection page titles/breadcrumbs, which currently have no right-click handler at all.

Confirmed decisions (via brainstorming):
- Manual recolor of any collection (parent or child) affects only that collection. No cascade in either direction. Shade-family cascade stays exactly as-is today (creation-time + drag-reparent only).
- Saved Colors persist server-side, per-user, in a new dedicated table. Auto-saved (MRU, deduped, capped) every time a color is applied — no explicit "save" action.
- Picker renders as an anchored popover (not a centered modal), reusing `ContextMenu`'s portal + viewport-clamped positioning approach.
- Native `EyeDropper` API included, feature-detected (`'EyeDropper' in window`), hidden on unsupported browsers.

## Backend

**Migration** `api/src/db/migrations/034_user_saved_colors.sql`:
```sql
CREATE TABLE user_saved_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_colors_format CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$')
);
CREATE INDEX user_saved_colors_user_id_idx ON user_saved_colors(user_id, created_at DESC);
```
Reuse `db-migration` skill conventions; run through the same `validateColor()` util for consistency with `collections`/`labels`.

**Service** `api/src/services/savedColorService.ts`:
- `listSavedColors(userId)` → most-recent-first, capped read (limit 16).
- `addSavedColor(userId, color)` → validate via `validateColor()`; delete any existing row for `(userId, color)` (dedupe), insert new row, then delete rows beyond the 16 most recent for that user (MRU cap). No `publishEvent()` — this is per-user picker chrome, not a synced entity type.

**Route** `api/src/routes/savedColors.ts`, mounted in `routes/index.ts` under `/api/v1/saved-colors`:
- `GET /` → `listSavedColors`
- `POST /` `{ color }` → `addSavedColor`, returns updated list

No changes needed to `collectionService.updateCollection` or its route — a color-only `PATCH /api/v1/collections/:id { color }` already round-trips through `publishCollectionEvent('updated', ...)` correctly with no cascade.

## Frontend

**Color conversion utils** — `app/src/utils/color.ts`: pure functions for hex↔hsv↔rgb↔hsl conversion, alpha handling, and formatting each mode's display string. Property-based tests (`fast-check`) for round-trip conversions.

**`ColorPickerPopover`** — `app/src/components/ui/ColorPickerPopover.tsx`, new component:
- Portal-rendered, anchored at trigger coordinates, reusing `ContextMenu.tsx`'s viewport-clamp/click-outside/Escape logic (extract the small clamp helper if it's cleanly separable, otherwise replicate the ~10 lines — it's small enough that duplication beats a forced abstraction).
- Saturation/lightness gradient square with draggable thumb (derived from current HSV).
- Hue slider + alpha slider (checkerboard background under the alpha gradient).
- Eyedropper icon button, feature-detected; add minimal ambient `EyeDropper` type declaration since it's not in the default TS lib.
- Format switcher (Hex / RGB / HSL) with matching input fields, mirroring the reference mockups.
- "Saved Colors" row: swatches from `GET /api/v1/saved-colors` (React Query).
- "App colors" row: static swatches from existing `PALETTE_COLORS`.
- Commit model: dragging the square/sliders updates local preview state live; the actual mutation fires once on drag-end (pointerup) or on text-input blur/Enter — not per-frame. Commit path: `runOptimistic` → `apiUpdateCollection(id, { color })` (already typed/supported in `client.ts`) → on success, `POST /api/v1/saved-colors`.

**Wiring**:
- `CollectionTreeNav.tsx`: add "Alterar cor..." as the **first** entry in the existing context-menu `items` array (currently Rename → Add sub-collection → separator → Delete), opening `ColorPickerPopover` anchored at the same `contextPos` used for `ContextMenu` today.
- `CollectionsPage.tsx` breadcrumb `<h1>` (`:410-441`): currently has zero context-menu wiring. Add `onContextMenu` per breadcrumb crumb, opening the same item set (Rename / Add sub-collection / Delete / Change color) targeting that crumb's collection id. Factor the item-array builder out of `CollectionTreeNav.tsx` into a small shared helper (e.g. `buildCollectionMenuItems(collection, handlers)`) so both call sites stay in sync instead of duplicating the array literal.

**i18n**: add `page.changeColor` (`'Change color…'` / `'Alterar cor…'`) plus picker-internal labels (saved colors / app colors / format names) to `en.ts` and `pt-BR.ts`, following the existing flat-key pattern.

## Testing

- Backend: `savedColorService` unit tests (dedupe, MRU cap at 16, validation rejection) against real Postgres; route test for `GET/POST /api/v1/saved-colors` (auth-gated); regression test confirming a color-only `PATCH /collections/:id` does not touch child rows.
- Frontend: property-based round-trip tests for `utils/color.ts` conversions; component tests for `ColorPickerPopover` (renders/applies via square+sliders+text inputs, saved/app-color swatch rows, eyedropper hidden when unsupported); test that "Alterar cor..." is the first sidebar menu item and opens the picker; test breadcrumb right-click opens the same menu targeting the correct collection.
- Manual: `docker compose up -d`, verify at `https://planner.local` — recolor a collection from the sidebar and from the breadcrumb title, confirm sidebar dot / breadcrumb dot / task-menu dot all update via sync, confirm child collections are untouched, confirm saved colors persist across reload.
