# Tasks: PageHeader + ButtonGroup unification

Confirmed: `page.upcoming` i18n key is used *only* at `DailyPage.tsx:858` -
safe to change the pt-BR value directly, no shared-key conflict.

**Course corrections during implementation (final state described below,
kept here for history):**

1. Today/Upcoming was briefly reverted to two separate `Button`s after a
   misread reference screenshot suggested they'd never been joined. A later,
   clearer reference (exact HTML with per-corner `border-radius` overrides)
   confirmed they *should* be a joined ButtonGroup after all - reverted back.
2. ButtonGroup was rebuilt a second time: instead of custom markup with its
   own container border/`overflow-hidden`/shared divider, it now renders real
   `Button` instances (`variant="primary"|"secondary"`, same as everywhere
   else in the app) and only flattens the touching corner of each segment
   (`rounded-l-none` / `rounded-r-none`). No wrapping container border - each
   segment carries its own border, and the flattened corners make adjacent
   segments read as one pill. This matches the reference pixel-for-pixel.
3. Added a `Toolbar` component (`app/src/components/ui/Toolbar.tsx`) that
   owns the `page-header-toolbar flex items-center gap-2` classes.
   `PageHeader`'s `toolbar` prop is now expected to be a `<Toolbar>` element;
   `PageHeader` dropped its `toolbarClassName` prop and no longer renders its
   own toolbar wrapper div.

## 1. ButtonGroup component

- [x] `app/src/components/ui/ButtonGroup.tsx` - discriminated-union props
      (`mode: 'single' | 'multi'`), `items`, `size` (passed straight through
      to `Button`'s own `ButtonSize`). Renders a real `Button` per item
      (`variant="primary"|"secondary"` by active state) with only the
      touching corner flattened (`rounded-l-none` / `rounded-r-none`) - no
      wrapping container border/`overflow-hidden`, `role="group"`, `aria-pressed`
- [x] `app/src/components/ui/__tests__/ButtonGroup.test.tsx` (TDD: write first)
      - single mode: clicking an item calls onChange(value), only one active
      - multi mode: clicking toggles that item in the value array, others unaffected
      - aria-pressed reflects active state per item
      - only the touching side of each segment is flattened
      - icon-only item (no showLabel) still gets aria-label from `label`
      - disabled item doesn't fire onChange

## 1b. Toolbar component

- [x] `app/src/components/ui/Toolbar.tsx` - owns `page-header-toolbar flex
      items-center gap-2`; `className` prop for the page-specific hook class
- [x] `app/src/components/ui/__tests__/Toolbar.test.tsx`

## 2. PageHeader component

- [x] `app/src/components/PageHeader.tsx` - title/subtitle/toolbar slots,
      identical markup/classes to current per-page headers. Gained an
      `afterTitle` slot (needed for CollectionsPage's inline sub-collection
      input) and `titleClassName`. `toolbar` prop expects a `<Toolbar>`
      element and is rendered as-is (no `toolbarClassName` - dropped once
      `Toolbar` existed to own that).
- [x] `app/src/components/__tests__/PageHeader.test.tsx` (TDD: write first)
      - renders title node (string and custom ReactNode)
      - renders subtitle `<p>` only when provided
      - renders toolbar slot content without double-wrapping it
      - carries `page-header-copy sticky-page-header max-w-162` classes

## 3. Migrate DailyPage

- [x] Reorder Today/Upcoming to `[Today, Upcoming]`
- [x] pt-BR `page.upcoming` → "Próximos dias" (`i18n/locales/pt-BR.ts:145`)
- [x] Today/Upcoming as a `ButtonGroup(mode: 'single')` (see course correction above)
- [x] Replace `TaskVisibilityControls` usage with `ButtonGroup(mode: 'multi')`
      (done inside `TaskVisibilityControls` itself, so `BoardToolbar`'s usage
      picked it up for free)
- [x] Wrap header in `<PageHeader>`, toolbar content in `<Toolbar>`
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

- [x] `npm test` (full app unit suite) - 1024/1024 pass
- [x] Add Playwright spec `e2e/toolbarControls.spec.ts`: Today/Upcoming
      order + joined-group corner flattening, list/kanban toggle,
      completed/notes toggle
- [x] `npm run test:e2e` - 8/8 pass (5 existing + 3 new)
- [x] `npm run lint`, `npm run build` - both clean
- [x] Screenshots taken live against `claude2.planner.local` for
      Daily/Inbox/Habits/Monthly/Collection-detail, confirming corner
      radius, active-fill, and pt-BR label all render correctly

## 11. PR

- [x] Push branch, mark draft PR ready for review
