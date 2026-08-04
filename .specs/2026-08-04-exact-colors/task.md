# Tasks: exact-colors refactor

## Backend Phase

### Database Migration
- [ ] Create `api/src/db/migrations/033_exact_collection_label_colors.sql`
  - [ ] Widen `collections.color` from VARCHAR(20) to VARCHAR(64)
  - [ ] Widen `labels.color` from VARCHAR(20) to VARCHAR(64)
  - [ ] Backfill both tables: name → hex via CASE WHEN mapping (use muted palette)
  - [ ] Add CHECK constraint to `collections.color` (hex/rgb/hsl regex)
  - [ ] Add CHECK constraint to `labels.color` (hex/rgb/hsl regex)

### Color Validator Utility
- [ ] Create `api/src/utils/color.ts` with `validateColor(color: unknown): string`
  - [ ] Implement color format validation (hex/rgb(a)/hsl(a))
  - [ ] Follow `AppError` + `ValidationError` pattern from `validate.ts`
  - [ ] Return string on success, throw on invalid format

### collectionService.ts
- [ ] Delete `SUPPORTED_COLORS` constant (lines 25-46)
- [ ] Import `validateColor` from `utils/color.ts`
- [ ] Replace whitelist check in `createCollection` with `validateColor(input.color)` call
- [ ] Replace whitelist check in `updateCollection` with `validateColor(input.color)` call
- [ ] Verify `formatCollection` passes color through untouched

### labelService.ts
- [ ] Delete `SUPPORTED_COLORS` constant (lines 5-26)
- [ ] Delete local `validateColor` function (lines 72-83)
- [ ] Import `validateColor` from `utils/color.ts`
- [ ] Replace validateColor call in `createLabel` with shared version
- [ ] Replace validateColor call in `updateLabel` with shared version

### Backend Tests & Fixtures
- [ ] Update `api/src/db/seed.ts`: replace color name literals with hex equivalents
  - [ ] `"blue"` → `#65788a`
  - [ ] `"sky_blue"` → `#6fa0d5`
  - [ ] `"green"` → `#7dbfb2`
  - [ ] `"violet"` → `#c2a29e`
- [ ] Update `api/src/routes/__tests__/collections.test.ts`: swap color names for hex
- [ ] Update `api/src/routes/__tests__/labels.test.ts`: swap color names for hex
- [ ] Update `api/src/services/__tests__/collectionService.test.ts`: fixtures + rejection test (malformed string instead of invalid name)
- [ ] Update `api/src/services/__tests__/labelService.test.ts`: fixtures + rejection test (malformed string instead of invalid name)
- [ ] Update `api/src/services/__tests__/viewService.test.ts`: swap color names for hex

## Frontend Phase

### PALETTE_COLORS & paletteColorHex cleanup
- [ ] Simplify `app/src/api/client.ts`:
  - [ ] Convert `PALETTE_COLORS` from `{ name, hex }[]` to flat hex string array
  - [ ] Delete `PALETTE_COLOR_HEX` Map (line 448)
  - [ ] Delete `paletteColorHex()` function (lines 450-452)
  - [ ] Keep muted hex values as-is (they become canonical)

### collectionStore.ts
- [ ] Update `CollectionTreeNode` interface: drop `colorName: string` field
- [ ] Update `buildCollectionTree()`: `color: paletteColorHex(p.color)` → `color: p.color`
- [ ] Remove `paletteColorHex` import

### Chip.tsx
- [ ] Update `CollectionChip`: `style={{ backgroundColor: color }}` (remove `paletteColorHex` call)
- [ ] Remove `paletteColorHex` import

### CollectionTreeNav.tsx
- [ ] Update `COLOR_SHADE_FAMILIES`: re-key from color **names** to **hex values**
  - [ ] Keep same shade-family grouping logic
  - [ ] Replace each name key with its hex: e.g. `red: [...]` → `'#c98079': [...]`
  - [ ] Update all array values to hex instead of names
- [ ] Update `getOriginalColor` fallback: `?? 'blue'` → `?? '#65788a'`
- [ ] Update `FlatCollection` interface: rename `colorName` to `color`
- [ ] Update `flattenCollections()` function to use renamed field
- [ ] Line 489: replace `paletteColorHex(item.colorName)` with `item.color`
- [ ] Remove `paletteColorHex` import

### CollectionsIndexPage.tsx
- [ ] Line 194 `nextColor()`: change from `.name` to direct hex string
- [ ] Remove unnecessary `paletteColorHex` usage if any
- [ ] Verify line 74 `node.color` already works (pre-resolved from store)

### Pages: DailyPage, InboxPage, CollectionsPage, StyleguidePage
- [ ] DailyPage.tsx (line 563): replace `paletteColorHex(c.color)` with `c.color`
- [ ] DailyPage.tsx (line 255): `<CollectionChip color={collection.color} />` already correct
- [ ] InboxPage.tsx (line 359): replace `paletteColorHex(c.color)` with `c.color`
- [ ] CollectionsPage.tsx (lines 350, 392, 398): replace all `paletteColorHex` calls with plain `color`
- [ ] StyleguidePage.tsx (line 140): replace `paletteColorHex(p.color)` with `p.color`
- [ ] StyleguidePage.tsx (line 413): replace `paletteColorHex(collection.color)` with `collection.color`
- [ ] StyleguidePage.tsx demo data (lines 58-74): replace color-name literals with hex
  - [ ] Update all collection fixtures to use hex values
- [ ] Remove all `paletteColorHex` imports from these files

### Frontend Tests
- [ ] Update `app/src/pages/__tests__/CollectionsPage.test.tsx`: replace color name fixtures with hex
- [ ] Update `app/src/stores/__tests__/collectionStore.test.ts`:
  - [ ] Replace color name fixtures with hex
  - [ ] Update line 125 hex assertion to new `#d56b64` (was stale at `#b8255f`)
  - [ ] Update any `colorName` references to `color`
- [ ] Update `app/src/components/__tests__/CollectionTreeNav.test.tsx`:
  - [ ] Replace color name fixtures with hex
  - [ ] Update `PALETTE_COLORS` mock to flat hex array
  - [ ] Delete `paletteColorHex` mock / adjust test expectations

## Verification

- [ ] `docker compose exec api npm test` — backend tests pass
- [ ] `docker compose exec app npm test` — frontend tests pass
- [ ] `docker compose exec api npm run lint` — no lingering references
- [ ] `docker compose exec app npm run lint` — no lingering references
- [ ] `docker compose exec app npm run build` — no type errors
- [ ] Manual browser test (https://planner.local):
  - [ ] Sidebar collection tree renders with muted colors
  - [ ] Today page collection dots use muted colors
  - [ ] Inbox page renders muted colors
  - [ ] /collections page renders muted colors
  - [ ] /styleguide renders muted colors
  - [ ] Creating new root collection cycles through swatch list
  - [ ] Nesting subcollection gets shade-family variant per depth
  - [ ] Drag-and-drop reparenting recomputes shade correctly
- [ ] Migration test: run against DB and verify both local and prod collections render same muted colors

## Notes

- No changes needed to `/p/linux/scripts/planner-db-sync` — it treats color as opaque CSV string
- Migrations run at container startup, so schema + backfill + app code land atomically
- Keep muted palette hex values as-is from uncommitted local edit in `app/src/api/client.ts`
