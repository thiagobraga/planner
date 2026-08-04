# Refactor collection/label colors: named strings → exact color values

## Context

`collections.color` and `labels.color` currently store a **name** (e.g. `lime_green`,
`berry_red`) drawn from a 20-value whitelist duplicated in
`api/src/services/collectionService.ts` and `api/src/services/labelService.ts`.
The frontend owns the only name→CSS-value mapping
(`PALETTE_COLORS` in `app/src/api/client.ts`) and resolves it at render time via
`paletteColorHex()`.

This indirection is why the same collection renders different colors in local vs
prod: `app/src/api/client.ts`'s `PALETTE_COLORS` table currently has an
**uncommitted** edit (muted palette) that doesn't match what's deployed to prod
(brighter palette, from commit `c6f4a38`). Because the DB only stores the name,
the actual rendered color is 100% dependent on whichever version of this one
frontend source file happens to be running — a single uncommitted local diff was
enough to make every collection look different.

Goal: eliminate the indirection. Store the literal color value (hex/hexa, `rgb()`/
`rgba()`, or `hsl()`/`hsla()`) directly in the DB. The DB becomes the single source
of truth for what a collection/label actually looks like — no more name→value
table that can drift between environments or between committed/uncommitted code.

Decisions locked in with the user:
- **Backfill source**: use the current *local* (muted) `PALETTE_COLORS` hex values
  as the one-time name→value conversion table. This also resolves the original
  dev/prod visual mismatch permanently, since after migration both DBs hold the
  same literal values regardless of what any frontend file contains.
- **DB constraint**: add a Postgres `CHECK` constraint validating the stored value
  matches hex/rgb(a)/hsl(a) syntax (defense-in-depth, matches the existing
  `habit_groups_icon_length` CHECK precedent).
- **Storage format**: store exactly what the client submits, no normalization —
  a row can hold `#d56b64` while another holds `rgb(101,120,138)`; CSS renders
  both directly so there's no need to force one format.

## Implementation Strategy

### Phase 1: Backend (database + services)
1. Create migration `033_exact_collection_label_colors.sql`: widen columns, backfill names to hex, add CHECK constraints
2. Create `api/src/utils/color.ts` validator to replace duplicated whitelists
3. Update `collectionService.ts` and `labelService.ts` to use shared validator
4. Update backend tests and seed data to use hex values

### Phase 2: Frontend (consumers of color field)
1. Simplify `PALETTE_COLORS` in `client.ts`, delete `paletteColorHex()` function
2. Update all component consumption sites to use `color` directly instead of transforming it
3. Update tests and demo data to use hex values

### Phase 3: Verification
Run full test suite, linting, manual browser verification across all pages
