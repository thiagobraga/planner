# Tasks: exact-colors refactor

## Backend Phase

### Database Migration
- [x] Create `api/src/db/migrations/033_exact_collection_label_colors.sql`
  - [x] Widen `collections.color` from VARCHAR(20) to VARCHAR(64)
  - [x] Widen `labels.color` from VARCHAR(20) to VARCHAR(64)
  - [x] Backfill both tables: name → hex via CASE WHEN mapping (use muted palette)
  - [x] Add CHECK constraint to `collections.color` (hex/rgb/hsl regex)
  - [x] Add CHECK constraint to `labels.color` (hex/rgb/hsl regex)

### Color Validator Utility
- [x] Create `api/src/utils/color.ts` with `validateColor(color: unknown): string`
  - [x] Implement color format validation (hex/rgb(a)/hsl(a))
  - [x] Follow `AppError` + `ValidationError` pattern from `validate.ts`
  - [x] Return string on success, throw on invalid format

### collectionService.ts
- [x] Delete `SUPPORTED_COLORS` constant (lines 25-46)
- [x] Import `validateColor` from `utils/color.ts`
- [x] Replace whitelist check in `createCollection` with `validateColor(input.color)` call
- [x] Replace whitelist check in `updateCollection` with `validateColor(input.color)` call
- [x] Verify `formatCollection` passes color through untouched

### labelService.ts
- [x] Delete `SUPPORTED_COLORS` constant (lines 5-26)
- [x] Delete local `validateColor` function (lines 72-83)
- [x] Import `validateColor` from `utils/color.ts`
- [x] Replace validateColor call in `createLabel` with shared version
- [x] Replace validateColor call in `updateLabel` with shared version

### Backend Tests & Fixtures
- [x] Update `api/src/db/seed.ts`: replace color name literals with hex equivalents
  - [x] `"blue"` → `#65788a`
  - [x] `"sky_blue"` → `#6fa0d5`
  - [x] `"green"` → `#7dbfb2`
  - [x] `"violet"` → `#c2a29e`
- [x] Update `api/src/routes/__tests__/collections.test.ts`: swap color names for hex
- [x] Update `api/src/routes/__tests__/labels.test.ts`: swap color names for hex
- [x] Update `api/src/services/__tests__/collectionService.test.ts`: fixtures + rejection test (malformed string instead of invalid name)
- [x] Update `api/src/services/__tests__/labelService.test.ts`: fixtures + rejection test (malformed string instead of invalid name)
- [x] Update `api/src/services/__tests__/viewService.test.ts`: swap color names for hex

## Frontend Phase

### PALETTE_COLORS & paletteColorHex cleanup
- [x] Simplify `app/src/api/client.ts`:
  - [x] Convert `PALETTE_COLORS` from `{ name, hex }[]` to flat hex string array
  - [x] Delete `PALETTE_COLOR_HEX` Map (line 448)
  - [x] Delete `paletteColorHex()` function (lines 450-452)
  - [x] Keep muted hex values as-is (they become canonical)

### collectionStore.ts
- [x] Update `CollectionTreeNode` interface: drop `colorName: string` field
- [x] Update `buildCollectionTree()`: `color: paletteColorHex(p.color)` → `color: p.color`
- [x] Remove `paletteColorHex` import

### Chip.tsx
- [x] Update `CollectionChip`: `style={{ backgroundColor: color }}` (remove `paletteColorHex` call)
- [x] Remove `paletteColorHex` import

### CollectionTreeNav.tsx
- [x] Update `COLOR_SHADE_FAMILIES`: re-key from color **names** to **hex values**
  - [x] Keep same shade-family grouping logic
  - [x] Replace each name key with its hex: e.g. `red: [...]` → `'#c98079': [...]`
  - [x] Update all array values to hex instead of names
- [x] Update `getOriginalColor` fallback: `?? 'blue'` → `?? '#65788a'`
- [x] Update `FlatCollection` interface: rename `colorName` to `color`
- [x] Update `flattenCollections()` function to use renamed field
- [x] Line 489: replace `paletteColorHex(item.colorName)` with `item.color`
- [x] Remove `paletteColorHex` import

### CollectionsIndexPage.tsx
- [x] Line 194 `nextColor()`: change from `.name` to direct hex string
- [x] Remove unnecessary `paletteColorHex` usage if any
- [x] Verify line 74 `node.color` already works (pre-resolved from store)

### Pages: DailyPage, InboxPage, CollectionsPage, StyleguidePage
- [x] DailyPage.tsx (line 563): replace `paletteColorHex(c.color)` with `c.color`
- [x] DailyPage.tsx (line 255): `<CollectionChip color={collection.color} />` already correct
- [x] InboxPage.tsx (line 359): replace `paletteColorHex(c.color)` with `c.color`
- [x] CollectionsPage.tsx (lines 350, 392, 398): replace all `paletteColorHex` calls with plain `color`
- [x] StyleguidePage.tsx (line 140): replace `paletteColorHex(p.color)` with `p.color`
- [x] StyleguidePage.tsx (line 413): replace `paletteColorHex(collection.color)` with `collection.color`
- [x] StyleguidePage.tsx demo data (lines 58-74): replace color-name literals with hex
  - [x] Update all collection fixtures to use hex values
- [x] Remove all `paletteColorHex` imports from these files

### Frontend Tests
- [x] Update `app/src/pages/__tests__/CollectionsPage.test.tsx`: replace color name fixtures with hex
- [x] Update `app/src/stores/__tests__/collectionStore.test.ts`:
  - [x] Replace color name fixtures with hex
  - [x] Update line 125 hex assertion to new `#d56b64` (was stale at `#b8255f`)
  - [x] Update any `colorName` references to `color`
- [x] Update `app/src/components/__tests__/CollectionTreeNav.test.tsx`:
  - [x] Replace color name fixtures with hex
  - [x] Update `PALETTE_COLORS` mock to flat hex array
  - [x] Delete `paletteColorHex` mock / adjust test expectations

## Verification

- [x] `docker compose exec api npm test` — backend tests pass
- [x] `docker compose exec app npm test` — frontend tests pass
- [x] `docker compose exec api npm run lint` — no lingering references
- [x] `docker compose exec app npm run lint` — no lingering references
- [x] `docker compose exec app npm run build` — no type errors
- [x] Manual browser test (https://claude.planner.local, isolated worktree instance):
  - [x] Sidebar collection tree renders with muted colors
  - [ ] Today page collection dots use muted colors (no tasks scheduled today in seed data — untested)
  - [x] Inbox page renders muted colors
  - [x] /collections page renders muted colors
  - [x] /styleguide renders muted colors
  - [x] Creating new root collection cycles through swatch list
  - [ ] Nesting subcollection gets shade-family variant per depth (not exercised manually)
  - [ ] Drag-and-drop reparenting recomputes shade correctly (not exercised manually)
- [x] Migration test: ran migration 033 against dev DB; collections/labels backfilled to hex matching seed data, rendered correctly in browser

## Notes

- No changes needed to `/p/linux/scripts/planner-db-sync` — it treats color as opaque CSV string
- Migrations run at container startup, so schema + backfill + app code land atomically
- Keep muted palette hex values as-is from uncommitted local edit in `app/src/api/client.ts`
