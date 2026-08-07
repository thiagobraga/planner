# Collection Color Picker — Tasks

## Backend

- [x] `api/src/db/migrations/035_user_saved_colors.sql` (034 was already taken by `034_preferences_date_format.sql`): create `user_saved_colors` table + format CHECK constraint + index (use `db-migration` skill)
- [x] `api/src/services/savedColorService.ts`: `listSavedColors(userId)` — MRU, capped at 16
- [x] `api/src/services/savedColorService.ts`: `addSavedColor(userId, color)` — validate via `validateColor()`, dedupe existing row for same color, insert, trim to cap of 16
- [x] `api/src/routes/savedColors.ts`: `GET /` and `POST /` handlers, auth-gated
- [x] `api/src/routes/index.ts`: mount `savedColors` router at `/api/v1/saved-colors`
- [x] `api/src/services/__tests__/savedColorService.test.ts`: dedupe, MRU cap at 16, validation rejection (real Postgres)
- [x] Route test for `GET/POST /api/v1/saved-colors`: auth-gated
- [x] `api/src/services/__tests__/collectionService.test.ts`: regression test — color-only PATCH doesn't cascade to child rows

## Frontend

- [x] `app/src/utils/color.ts`: hex↔hsv↔rgb↔hsl conversion + per-format display string helpers
- [x] `app/src/utils/__tests__/color.test.ts`: property-based round-trip tests (fast-check)
- [x] `app/src/types/eyedropper.d.ts`: ambient `EyeDropper` API type declaration
- [x] `app/src/components/ui/ColorPickerPopover.tsx`: gradient square + hue/alpha sliders + eyedropper + format switcher (Hex/RGB/HSL) + Saved Colors row + App colors row; commit on drag-end/blur via `runOptimistic` + `apiUpdateCollection`, then `POST /api/v1/saved-colors`
- [x] `app/src/components/CollectionTreeNav.tsx`: extract `buildCollectionMenuItems(collection, handlers)` shared helper from existing inline items array
- [x] `app/src/components/CollectionTreeNav.tsx`: add "Alterar cor..." as first context-menu item, wire `ColorPickerPopover` open state anchored at `contextPos`
- [x] `app/src/pages/CollectionsPage.tsx`: wire `onContextMenu` on each breadcrumb crumb using shared `buildCollectionMenuItems`, opening `ColorPickerPopover` for that crumb's collection
- [x] `app/src/i18n/locales/en.ts` + `pt-BR.ts`: add `page.changeColor` and picker-internal labels (saved colors / app colors / format names)
- [x] `app/src/components/ui/__tests__/ColorPickerPopover.test.tsx`: renders/applies via square+sliders+text inputs; saved/app swatch rows render fetched/static data; eyedropper hidden when `EyeDropper` unsupported
- [x] `app/src/components/__tests__/CollectionTreeNav.test.tsx`: "Alterar cor..." is first menu item, opens picker
- [x] `app/src/pages/__tests__/CollectionsPage.test.tsx`: breadcrumb right-click opens menu targeting correct collection

## Manual verification

- [x] `docker compose up -d`, verify at `https://planner.local`: recolor via sidebar context menu and via breadcrumb title; confirm sidebar dot, breadcrumb dot, and task-menu dot all update via sync; confirm child collections are untouched by a parent recolor; confirm saved colors persist across reload

## Added during implementation

- [x] `app/src/pages/CollectionsIndexPage.tsx`: wire the shared menu + `ColorPickerPopover` into the `/collections` index rows (requested mid-implementation)
- [x] `app/src/pages/__tests__/CollectionsIndexPage.test.tsx`: "Change color…" is first, picker seeded with the row colour, recolor hits only that row
- [x] `api/src/services/authService.ts`: fix pre-existing registration failure — the Inbox seed used the legacy `'grey'` literal, which migration 033's `collections_color_format` CHECK rejects, aborting every register transaction
- [x] `api/src/services/__tests__/authService.test.ts`: regression test that the Inbox seed colour satisfies the CHECK constraint
