# Task Breakdown: Daily UX Adjustments & Today Navigation

Detailed implementation breakdown with technical architecture and actionable subtasks.

---

## 1. Global Keyboard Shortcut 't' (Scroll to Today)

- [ ] **1.1 Shortcut matcher definition**
  - [ ] Add `{ key: 't', context: 'global', action: 'scroll:today' }` to `DEFAULT_BINDINGS` in `app/src/hooks/shortcuts.ts`
  - [ ] Verify no conflicts with existing single keys or chords
- [ ] **1.2 AppShell event dispatch**
  - [ ] Handle `scroll:today` in `AppShell.tsx` (`handleAction`)
  - [ ] Dispatch `window.dispatchEvent(new CustomEvent('scroll-to-today'))`
- [ ] **1.3 DailyPage listener**
  - [ ] Listen to `scroll-to-today` in `app/src/pages/DailyPage.tsx`
  - [ ] Invoke `handleToday()` to smoothly scroll `todaySectionRef.current` into view
- [ ] **1.4 HabitsPage listener**
  - [ ] Listen to `scroll-to-today` in `app/src/pages/HabitsPage.tsx`
  - [ ] Increment `todaySignal` in timeline view or navigate to current month in calendar view
- [ ] **1.5 MonthlyPage listener**
  - [ ] Listen to `scroll-to-today` in `app/src/pages/MonthlyPage.tsx`
  - [ ] Reset `selected` state to `{ year: today.getFullYear(), month: today.getMonth() }`
  - [ ] Scroll current day row into view in `app/src/components/monthly/MonthlyRows.tsx`

---

## 2. Header Controls & Viewport-Aware "Hoje" Button

- [ ] **2.1 Decouple header buttons**
  - [ ] Remove `<ButtonGroup>` wrapping `'today'` and `'upcoming'` in `app/src/pages/DailyPage.tsx`
  - [ ] Render a standalone toggle `<Button>` for "Próximos dias" (`t('page.upcoming')`)
- [ ] **2.2 Viewport IntersectionObserver**
  - [ ] Set up `IntersectionObserver` referencing `todaySectionRef.current` in `app/src/pages/DailyPage.tsx`
  - [ ] Track boolean state `isTodayInViewport` on scroll / intersection changes
- [ ] **2.3 Position and smooth fade-in for "Hoje"**
  - [ ] Render "Hoje" button (`t('page.today')`) after `<TaskVisibilityControls>`
  - [ ] Apply fade transition (`opacity-0 pointer-events-none` when `isTodayInViewport` is true, `opacity-100 pointer-events-auto` when false)
  - [ ] Attach `onClick={handleToday}` to scroll back to Today

---

## 3. Midnight & Timezone Dynamic Today Sync

- [ ] **3.1 Reactive Today Key State**
  - [ ] Replace static `useMemo` for `todayKey` with reactive state in `app/src/pages/DailyPage.tsx`
  - [ ] Update `todayKey` when `prefs?.timeZone` changes
  - [ ] Update `todayKey` inside `useMidnightTimer` callback on midnight rollover
- [ ] **3.2 Render & Input Form Synchronization**
  - [ ] Ensure `buildSections` and `replaceTodayFromApi` receive synchronized `todayKey`
  - [ ] Ensure `isToday` (`section.key === todayKey`) correctly mounts `· HOJE` badge and "Nova tarefa..." input form on the active day

---

## 4. Prune Empty Past Day Sections

- [ ] **4.1 Section pruning helper**
  - [ ] Define `pruneEmptySections(sections: DaySection[], currentTodayKey: string): DaySection[]` in `app/src/pages/DailyPage.tsx`
  - [ ] Retain sections only if `s.key === currentTodayKey` OR `s.tasks.length > 0`
- [ ] **4.2 Apply pruning across task actions**
  - [ ] Prune empty past sections on task completion in `handleToggle` (when completed tasks are hidden)
  - [ ] Prune empty past sections on task deletion in `handleDelete` and empty `handleEditCommit`
  - [ ] Prune empty past sections on drag & drop in `useTaskDrag`
  - [ ] Prune empty past sections on remote sync events in `useSync`

---

## 5. Upcoming Tasks Persistence & Recurrent Task Sync

- [ ] **5.1 Default state & storage persistence**
  - [ ] Default `loadShowUpcoming()` strictly to `false` when no stored preference exists
  - [ ] Persist `showUpcoming` updates to `localStorage` under `SHOW_UPCOMING_STORAGE_KEY`
- [ ] **5.2 Reactive sync for recurring tasks and upcoming events**
  - [ ] In `useSync`, on task creation / update / completion:
    - [ ] If `showUpcoming` is `true`, call `fetchUpcomingFromApi()` to dynamically display newly generated recurring task occurrences
    - [ ] If `showUpcoming` is `false`, keep `showUpcoming` as `false` and do not auto-open

---

## 6. Testing & Verification

- [ ] **6.1 Unit & Behavior Tests (`app/src/pages/__tests__/DailyPage.behavior.test.tsx`)**
  - [ ] Test standalone "Próximos dias" toggle button and `localStorage` persistence
  - [ ] Test "Hoje" button visibility based on intersection observer
  - [ ] Test empty past day pruning when completing or deleting tasks
  - [ ] Test recurring task completion when upcoming is enabled vs disabled
- [ ] **6.2 Keyboard Shortcuts Unit Tests (`app/src/hooks/__tests__/shortcuts.test.ts`)**
  - [ ] Verify pressing `t` matches `scroll:today` in global context
  - [ ] Verify pressing `t` is ignored when a text input or textarea is focused
- [ ] **6.3 Full App Test Suite Validation**
  - [ ] Run `docker compose exec app npm test`
