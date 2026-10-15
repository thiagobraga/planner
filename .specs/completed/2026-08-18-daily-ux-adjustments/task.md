# Task Breakdown: Daily UX Adjustments & Today Navigation

Detailed implementation breakdown with technical architecture and actionable subtasks.

---

## 1. Global Keyboard Shortcut 't' (Scroll to Today)

- [n] **1.1 Shortcut matcher definition**
  - [n] Add `{ key: 't', context: 'global', action: 'scroll:today' }` to `DEFAULT_BINDINGS` in `app/src/hooks/shortcuts.ts`
  - [n] Verify no conflicts with existing single keys or chords
- [n] **1.2 AppShell event dispatch**
  - [n] Handle `scroll:today` in `AppShell.tsx` (`handleAction`)
  - [n] Dispatch `window.dispatchEvent(new CustomEvent('scroll-to-today'))`
- [n] **1.3 DailyPage listener**
  - [n] Listen to `scroll-to-today` in `app/src/pages/DailyPage.tsx`
  - [n] Invoke `handleToday()` to smoothly scroll `todaySectionRef.current` into view
- [n] **1.4 HabitsPage listener**
  - [n] Listen to `scroll-to-today` in `app/src/pages/HabitsPage.tsx`
  - [n] Increment `todaySignal` in timeline view or navigate to current month in calendar view
- [n] **1.5 MonthlyPage listener**
  - [n] Listen to `scroll-to-today` in `app/src/pages/MonthlyPage.tsx`
  - [n] Reset `selected` state to `{ year: today.getFullYear(), month: today.getMonth() }`
  - [n] Scroll current day row into view in `app/src/components/monthly/MonthlyRows.tsx`

---

## 2. Header Controls & Viewport-Aware "Hoje" Button

- [n] **2.1 Decouple header buttons**
  - [n] Remove `<ButtonGroup>` wrapping `'today'` and `'upcoming'` in `app/src/pages/DailyPage.tsx`
  - [n] Render a standalone toggle `<Button>` for "Próximos dias" (`t('page.upcoming')`)
- [n] **2.2 Viewport IntersectionObserver**
  - [n] Set up `IntersectionObserver` referencing `todaySectionRef.current` in `app/src/pages/DailyPage.tsx`
  - [n] Track boolean state `isTodayInViewport` on scroll / intersection changes
- [n] **2.3 Position and smooth fade-in for "Hoje"**
  - [n] Render "Hoje" button (`t('page.today')`) after `<TaskVisibilityControls>`
  - [n] Apply fade transition (`opacity-0 pointer-events-none` when `isTodayInViewport` is true, `opacity-100 pointer-events-auto` when false)
  - [n] Attach `onClick={handleToday}` to scroll back to Today

---

## 3. Midnight & Timezone Dynamic Today Sync

- [n] **3.1 Reactive Today Key State**
  - [n] Replace static `useMemo` for `todayKey` with reactive state in `app/src/pages/DailyPage.tsx`
  - [n] Update `todayKey` when `prefs?.timeZone` changes
  - [n] Update `todayKey` inside `useMidnightTimer` callback on midnight rollover
- [n] **3.2 Render & Input Form Synchronization**
  - [n] Ensure `buildSections` and `replaceTodayFromApi` receive synchronized `todayKey`
  - [n] Ensure `isToday` (`section.key === todayKey`) correctly mounts `· HOJE` badge and "Nova tarefa..." input form on the active day

---

## 4. Prune Empty Past Day Sections

- [n] **4.1 Section pruning helper**
  - [n] Define `pruneEmptySections(sections: DaySection[], currentTodayKey: string): DaySection[]` in `app/src/pages/DailyPage.tsx`
  - [n] Retain sections only if `s.key === currentTodayKey` OR `s.tasks.length > 0`
- [n] **4.2 Apply pruning across task actions**
  - [n] Prune empty past sections on task completion in `handleToggle` (when completed tasks are hidden)
  - [n] Prune empty past sections on task deletion in `handleDelete` and empty `handleEditCommit`
  - [n] Prune empty past sections on drag & drop in `useTaskDrag`
  - [n] Prune empty past sections on remote sync events in `useSync`

---

## 5. Upcoming Tasks Persistence & Recurrent Task Sync

- [n] **5.1 Default state & storage persistence**
  - [n] Default `loadShowUpcoming()` strictly to `false` when no stored preference exists
  - [n] Persist `showUpcoming` updates to `localStorage` under `SHOW_UPCOMING_STORAGE_KEY`
- [n] **5.2 Reactive sync for recurring tasks and upcoming events**
  - [n] In `useSync`, on task creation / update / completion:
    - [n] If `showUpcoming` is `true`, call `fetchUpcomingFromApi()` to dynamically display newly generated recurring task occurrences
    - [n] If `showUpcoming` is `false`, keep `showUpcoming` as `false` and do not auto-open

---

## 6. Testing & Verification

- [n] **6.1 Unit & Behavior Tests (`app/src/pages/__tests__/DailyPage.behavior.test.tsx`)**
  - [n] Test standalone "Próximos dias" toggle button and `localStorage` persistence
  - [n] Test "Hoje" button visibility based on intersection observer
  - [n] Test empty past day pruning when completing or deleting tasks
  - [n] Test recurring task completion when upcoming is enabled vs disabled
- [n] **6.2 Keyboard Shortcuts Unit Tests (`app/src/hooks/__tests__/shortcuts.test.ts`)**
  - [n] Verify pressing `t` matches `scroll:today` in global context
  - [n] Verify pressing `t` is ignored when a text input or textarea is focused
- [n] **6.3 Full App Test Suite Validation**
  - [n] Run `docker compose exec app npm test`
