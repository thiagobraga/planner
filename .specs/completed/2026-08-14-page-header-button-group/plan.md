# Plan: PageHeader + ButtonGroup unification

## Problem

Every page header (`DailyPage`, `MonthlyPage`, `HabitsPage`, `InboxPage`,
`CollectionsPage`) repeats the same `<header className="page-header-copy
sticky-page-header ...">` / `page-header-copy-text` / `page-header-toolbar`
markup verbatim. Inside those headers, three different toggle controls
(`ViewToolbar`'s list/kanban switch, `HabitsPage`'s timeline/calendar switch,
`TaskVisibilityControls`'s completed/notes switch) each reimplement the same
"joined pill" segmented-button pattern with slightly different markup, and
none of them match the corner-radius handling the user actually wants
(`DailyPage`'s Today/Upcoming buttons, which are two independent `<Button>`s
with a gap, not a joined group at all).

A `PageHeader` component was attempted once before (2026-08-08) and reverted.
The revert coincided with a since-abandoned CSS rewrite (absolutely-positioned
toolbar). The CSS has since settled on a static, left-aligned toolbar row
(`index.css` `.sticky-page-header` / `.page-header-toolbar`, undated comment
"replaces the old absolutely positioned top-right toolbar"). This plan wraps
the *current* settled markup/CSS in a component rather than changing it, so it
does not repeat whatever caused the earlier revert.

## Components

### `ButtonGroup` — `app/src/components/ui/ButtonGroup.tsx`

Single reusable joined-pill segmented control. Discriminated union so
single-select and multi-select toggle groups share one component with type
safety:

```ts
interface ButtonGroupItem<T extends string> {
  value: T;
  label: string;       // used as aria-label/title; visible text when showLabel
  icon?: ReactNode;
  showLabel?: boolean;
}

type ButtonGroupProps<T extends string> =
  | { mode: 'single'; value: T; onChange: (value: T) => void }
  | { mode: 'multi'; value: T[]; onChange: (value: T) => void } // toggles clicked value
) & {
  items: ButtonGroupItem<T>[];
  size?: 'xs' | 'sm' | 'md'; // matches Button's height/padding scale
  compact?: boolean;
  className?: string;
  'aria-label'?: string;
};
```

Visuals: active segment renders the `Button` "primary" look (`bg-ink
text-cream border-ink`), inactive renders "secondary". One shared container
border, `border-l` dividers between segments, and — the actual bug being
fixed — **`first:rounded-l-* last:rounded-r-*` only**, so only the outer two
corners round regardless of which segment is active. `role="group"`,
`aria-pressed` per segment (matches the existing convention across all three
call sites being replaced).

### `PageHeader` — `app/src/components/PageHeader.tsx`

Pure JSX de-dup of the current header markup. No CSS changes.

```ts
interface PageHeaderProps {
  title: ReactNode;      // string, or a custom node (CollectionsPage breadcrumb trail)
  subtitle?: string;
  toolbar?: ReactNode;
  className?: string;
}
```

Renders exactly the markup every page already has:
`<header className="page-header-copy sticky-page-header max-w-162 ${className}">`
→ `page-header-copy-text` (h1 + optional p.page-header-subtitle) →
`page-header-toolbar` (toolbar prop).

## Migration

| Page | Title prop | Toolbar contents |
| --- | --- | --- |
| `DailyPage` | `t('page.daily')` | Reorganize `Button` (conditional) + `ButtonGroup` (Today/Upcoming, single) + `ButtonGroup` (completed/notes, multi) |
| `MonthlyPage` | `t('page.monthly')` | lone "Today" `Button` (unchanged — not a group) |
| `HabitsPage` | `t('page.habits')` | "Today" `Button` + `ButtonGroup` (timeline/calendar, single, icon-only) |
| `InboxPage` | `t('page.inbox')` | `BoardToolbar` (internally: `ButtonGroup` list/kanban single + `GroupBySelect` + `ButtonGroup` completed/notes multi) |
| `CollectionsPage` | breadcrumb trail node (unchanged custom JSX) | same `BoardToolbar` as InboxPage |

### DailyPage Today/Upcoming specifics

- Reorder: `[Today, Upcoming]` (was `[Upcoming, Today]`).
- pt-BR label for Upcoming: "Próximos dias" (was "Próximas"). Update both
  locale catalogs' `page.upcoming` key (or add a dedicated toolbar key if
  `page.upcoming` is reused elsewhere with the old text — check before
  renaming the shared key).
- Becomes `mode: 'single'`, values `'today' | 'upcoming'`. Clicking "Today"
  calls `handleToday()` (scroll), clicking "Upcoming" calls `toggleUpcoming()`.
  Since these aren't mutually exclusive *state* today (Today is an action,
  Upcoming is a toggle) — decide during implementation whether "Today" shows
  as always-inactive (it's a scroll action, not a persistent state) or tracks
  `!showUpcoming`. Recommend: `value = showUpcoming ? 'upcoming' : 'today'`,
  clicking either sets `showUpcoming` accordingly and Today also scrolls.

### TaskVisibilityControls → ButtonGroup(multi)

Preserve exact `aria-label`/`title` text (`visibility.hideCompleted` /
`visibility.showCompleted` / etc.) and icon swap behavior (Eye/EyeOff toggle
based on state) so existing consumers and tests keep working unchanged where
possible.

### ViewToolbar list/kanban → ButtonGroup(single)

Preserve `toolbar.list` / `toolbar.kanban` labels, `List`/`Kanban` icons
already swapped to `ListTodo`/`Kanban` earlier this session.

### HabitsPage timeline/calendar → ButtonGroup(single)

Icon-only (`DotsConnectedIcon`, `Calendar`), preserve `aria-label`.

## Testing

- **Unit (Vitest):** `ButtonGroup.test.tsx` — single-select click semantics,
  multi-select toggle semantics, `aria-pressed` state, corner-radius classes
  only on first/last segment, disabled state. `PageHeader.test.tsx` — renders
  title/subtitle/toolbar slots, omits subtitle `<p>` when not provided.
- **Existing suites:** run full `app` unit suite after migration; fix any
  selector breakage. Aria-label/title text is preserved by design so most
  existing tests (`DailyPage.test.tsx`, `DailyPage.behavior.test.tsx`,
  `InboxPage.views.test.tsx`, `HabitsPage.test.tsx`, `BoardToolbar.test.tsx`,
  `primitives.test.tsx`) should need minimal changes.
- **E2E (Playwright):** extend/add a spec covering: Today/Upcoming order +
  pt-BR label, list/kanban toggle, completed/notes toggle — exercised on at
  least DailyPage and InboxPage.
- **TDD:** write `ButtonGroup`/`PageHeader` tests first (red), implement
  (green), then migrate each page one at a time, running that page's test
  file after each migration before moving to the next.

## Risk / rollback

- No CSS/positioning changes — only JSX de-duplication and control-swap. If
  something regresses, `git revert` the offending page's commit in isolation
  (small per-file commits per CLAUDE.md convention) rather than the whole
  branch.
- `page.upcoming` i18n key rename is the one cross-cutting risk — grep all
  usages before changing it.
