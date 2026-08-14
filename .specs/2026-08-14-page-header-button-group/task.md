# Tasks: PageHeader + ButtonGroup unification

Confirmed: `page.upcoming` i18n key is used *only* at `DailyPage.tsx:858` -
safe to change the pt-BR value directly, no shared-key conflict.

## 1. ButtonGroup component

- [ ] `app/src/components/ui/ButtonGroup.tsx` - discriminated-union props
      (`mode: 'single' | 'multi'`), `items`, `size`, active=primary/inactive=secondary
      styling, `first:rounded-l last:rounded-r`, `role="group"`, `aria-pressed`
- [ ] `app/src/components/ui/__tests__/ButtonGroup.test.tsx` (TDD: write first)
      - single mode: clicking an item calls onChange(value), only one active
      - multi mode: clicking toggles that item in the value array, others unaffected
      - aria-pressed reflects active state per item
      - only first/last segment carry rounding classes
      - icon-only item (no showLabel) still gets aria-label from `label`
      - disabled item doesn't fire onChange

## 2. PageHeader component

- [ ] `app/src/components/PageHeader.tsx` - title/subtitle/toolbar slots,
      identical markup/classes to current per-page headers
- [ ] `app/src/components/__tests__/PageHeader.test.tsx` (TDD: write first)
      - renders title node (string and custom ReactNode)
      - renders subtitle `<p>` only when provided
      - renders toolbar slot content
      - carries `page-header-copy sticky-page-header max-w-162` classes

## 3. Migrate DailyPage

- [ ] Reorder Today/Upcoming to `[Today, Upcoming]`
- [ ] pt-BR `page.upcoming` → "Próximos dias" (`i18n/locales/pt-BR.ts:145`)
- [ ] Replace Today/Upcoming buttons with `ButtonGroup(mode: 'single')`
- [ ] Replace `TaskVisibilityControls` usage with `ButtonGroup(mode: 'multi')`
      (or update `TaskVisibilityControls` internals to render via `ButtonGroup`
      - prefer this so `BoardToolbar`'s usage picks it up for free)
- [ ] Wrap header in `<PageHeader>`
- [ ] Run `DailyPage.test.tsx`, `DailyPage.behavior.test.tsx`,
      `DailyPage.dateFormat.test.tsx`, `DailyPage.createDate.test.tsx` - fix breakage

## 4. Migrate TaskVisibilityControls (shared - feeds Daily/Inbox/Collections)

- [ ] Rewrite `app/src/components/TaskVisibilityControls.tsx` internals to
      render via `ButtonGroup(mode: 'multi')`, preserving its external props
      API and `aria-label`/`title` text exactly
- [ ] Run its existing tests + `BoardToolbar.test.tsx`

## 5. Migrate ViewToolbar (shared - feeds Inbox/Collections via BoardToolbar)

- [ ] Rewrite list/kanban toggle in `app/src/components/ui/ViewToolbar.tsx`
      to use `ButtonGroup(mode: 'single')`, preserving `toolbar.list` /
      `toolbar.kanban` labels and `ListTodo`/`Kanban` icons
- [ ] Run `primitives.test.tsx`, `BoardToolbar.test.tsx`

## 6. Migrate MonthlyPage

- [ ] Wrap header in `<PageHeader>` (toolbar stays a lone `Button`, no group)
- [ ] Run `MonthlyPage.test.tsx`

## 7. Migrate HabitsPage

- [ ] Replace timeline/calendar toggle with `ButtonGroup(mode: 'single')`,
      icon-only (`DotsConnectedIcon`, `Calendar`)
- [ ] Wrap header in `<PageHeader>`
- [ ] Run `HabitsPage.test.tsx`

## 8. Migrate InboxPage

- [ ] Wrap header in `<PageHeader>`
- [ ] Run `InboxPage.test.tsx`, `InboxPage.views.test.tsx`

## 9. Migrate CollectionsPage

- [ ] Wrap header in `<PageHeader>` (title = existing breadcrumb trail JSX)
- [ ] Run `CollectionsPage.test.tsx`

## 10. Full regression + E2E

- [ ] `npm test` (full app unit suite) - zero failures
- [ ] Add/extend Playwright spec: Today/Upcoming order + pt-BR label,
      list/kanban toggle, completed/notes toggle on Daily + Inbox
- [ ] `npm run test:e2e`
- [ ] `npm run lint`, `npm run build`
- [ ] Screenshots to `app/dist/screenshots/` for each migrated page
      (before/after not needed - just confirm final look matches design)

## 11. PR

- [ ] Push branch, mark draft PR ready for review
