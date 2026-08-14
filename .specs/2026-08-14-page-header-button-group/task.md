# Tasks: PageHeader + ButtonGroup unification

Confirmed: `page.upcoming` i18n key is used *only* at `DailyPage.tsx:858` -
safe to change the pt-BR value directly, no shared-key conflict.

**Course correction during implementation:** Today/Upcoming (and Organize)
turned out to never have been a joined segmented control in the original UI -
each is its own independent rounded pill with a gap. An earlier pass wrongly
joined them into a ButtonGroup based on a misread reference screenshot; reverted
to two separate `Button`s, keeping only the `[Today, Upcoming]` reorder and the
pt-BR "Próximos dias" relabel. ButtonGroup is used only where a joined
segmented control already existed: list/kanban, timeline/calendar,
completed/notes.

## 1. ButtonGroup component

- [x] `app/src/components/ui/ButtonGroup.tsx` - discriminated-union props
      (`mode: 'single' | 'multi'`), `items`, `size`, active=primary/inactive=secondary
      styling, `first:rounded-l last:rounded-r`, `role="group"`, `aria-pressed`
- [x] `app/src/components/ui/__tests__/ButtonGroup.test.tsx` (TDD: write first)
      - single mode: clicking an item calls onChange(value), only one active
      - multi mode: clicking toggles that item in the value array, others unaffected
      - aria-pressed reflects active state per item
      - only first/last segment carry rounding classes
      - icon-only item (no showLabel) still gets aria-label from `label`
      - disabled item doesn't fire onChange

## 2. PageHeader component

- [x] `app/src/components/PageHeader.tsx` - title/subtitle/toolbar slots,
      identical markup/classes to current per-page headers. Also gained an
      `afterTitle` slot (needed for CollectionsPage's inline sub-collection
      input) and `titleClassName`/`toolbarClassName` overrides.
- [x] `app/src/components/__tests__/PageHeader.test.tsx` (TDD: write first)
      - renders title node (string and custom ReactNode)
      - renders subtitle `<p>` only when provided
      - renders toolbar slot content
      - carries `page-header-copy sticky-page-header max-w-162` classes

## 3. Migrate DailyPage

- [x] Reorder Today/Upcoming to `[Today, Upcoming]`
- [x] pt-BR `page.upcoming` → "Próximos dias" (`i18n/locales/pt-BR.ts:145`)
- [x] Today/Upcoming stay as two separate `Button`s (see course correction above)
- [x] Replace `TaskVisibilityControls` usage with `ButtonGroup(mode: 'multi')`
      (done inside `TaskVisibilityControls` itself, so `BoardToolbar`'s usage
      picked it up for free)
- [x] Wrap header in `<PageHeader>`
- [x] Run `DailyPage.test.tsx`, `DailyPage.behavior.test.tsx`,
      `DailyPage.dateFormat.test.tsx`, `DailyPage.createDate.test.tsx` - all pass

## 4. Migrate TaskVisibilityControls (shared - feeds Daily/Inbox/Collections)

- [x] Rewrite `app/src/components/TaskVisibilityControls.tsx` internals to
      render via `ButtonGroup(mode: 'multi')`, preserving its external props
      API and `aria-label`/`title` text exactly
- [x] Run its existing tests + `BoardToolbar.test.tsx` - all pass

## 5. Migrate ViewToolbar (shared - feeds Inbox/Collections via BoardToolbar)

- [x] Rewrite list/kanban toggle in `app/src/components/ui/ViewToolbar.tsx`
      to use `ButtonGroup(mode: 'single')`, preserving `toolbar.list` /
      `toolbar.kanban` labels and `ListTodo`/`Kanban` icons
- [x] Run `primitives.test.tsx`, `BoardToolbar.test.tsx` - all pass

## 6. Migrate MonthlyPage

- [x] Wrap header in `<PageHeader>` (toolbar stays a lone `Button`, no group)
- [x] Run `MonthlyPage.test.tsx` - all pass

## 7. Migrate HabitsPage

- [x] Replace timeline/calendar toggle with `ButtonGroup(mode: 'single')`,
      icon-only (`DotsConnectedIcon`, `Calendar`)
- [x] Wrap header in `<PageHeader>`
- [x] Run `HabitsPage.test.tsx` - all pass

## 8. Migrate InboxPage

- [x] Wrap header in `<PageHeader>`
- [x] Run `InboxPage.test.tsx`, `InboxPage.views.test.tsx` - all pass

## 9. Migrate CollectionsPage

- [x] Wrap header in `<PageHeader>` (title = existing breadcrumb trail JSX,
      via `titleClassName`; inline sub-collection input moved to `afterTitle`)
- [x] Run `CollectionsPage.test.tsx` - all pass

## 10. Full regression + E2E

- [x] `npm test` (full app unit suite) - 1022/1022 pass
- [x] Add Playwright spec `e2e/toolbarControls.spec.ts`: Today/Upcoming
      order (separate buttons), list/kanban toggle, completed/notes toggle
- [x] `npm run test:e2e` - 8/8 pass (5 existing + 3 new)
- [x] `npm run lint`, `npm run build` - both clean
- [x] Screenshots taken live against `claude2.planner.local` for
      Daily/Inbox/Habits/Monthly/Collection-detail, confirming corner
      radius, active-fill, and pt-BR label all render correctly

## 11. PR

- [x] Push branch, mark draft PR ready for review
