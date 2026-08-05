# Task Breakdown: Task Interactions, Context Menus, Fast Dragging & Date Format Preference

- [x] Task Selection & Multi-select State <!-- id: 0 -->
  - [x] Create Zustand `taskSelectionStore.ts` for managing selected task IDs <!-- id: 1 -->
  - [x] Add unit tests for `taskSelectionStore` in `app/src/stores/__tests__/taskSelectionStore.test.ts` <!-- id: 2 -->
  - [x] Update `TaskItem.tsx` with desktop click select, Ctrl/Cmd multi-select, mobile tap select, and selection highlight styles <!-- id: 3 -->
  - [x] Update `TaskItem.test.tsx` and `TaskItem.interaction.test.tsx` for click and multi-select behavior <!-- id: 4 -->

- [x] Fast Dragging & Drag Handle Removal <!-- id: 5 -->
  - [x] Remove `⠿` drag handle from `TaskItem.tsx` <!-- id: 6 -->
  - [x] Update `sensors.ts` pointer sensor activation delay to 80-100ms and allow whole-row dragging on pointer/touch <!-- id: 7 -->
  - [x] Verify dragging speed and responsiveness on desktop and touch devices <!-- id: 8 -->

- [x] Context Menus & Icons Expansion <!-- id: 9 -->
  - [x] Update task context menus in `DailyPage`, `InboxPage`, `CollectionsPage` with Lucide icons (Calendar, Tag, Folder, ArrowUp, ArrowDown, Trash2) <!-- id: 10 -->
  - [x] Add context menu with icons to habit rows in `HabitTimeline.tsx` for right-click & touch long-press <!-- id: 11 -->
  - [x] Add collection context menu (Rename, Add sub-collection, Delete) with icons in `CollectionTreeNav.tsx` and `CollectionsIndexPage.tsx` <!-- id: 12 -->
  - [x] Remove `>` chevron icon on collection rows in `CollectionsIndexPage.tsx` <!-- id: 13 -->
  - [x] Add touch long-press trigger for context menu on mobile <!-- id: 14 -->
  - [x] Write unit tests for context menus with icons in `app/src/components/__tests__/ContextMenu.icons.test.tsx` <!-- id: 15 -->

- [x] Daily Page Date Display Format Setting <!-- id: 16 -->
  - [x] Create migration `034_preferences_date_format.sql` for `date_format` column in `preferences` table <!-- id: 17 -->
  - [x] Update `preferencesService.ts` in `api` with `dateFormat` schema, default, and validation <!-- id: 18 -->
  - [x] Update `DailyPage.tsx` and `date.ts` to format section header dates dynamically based on user preference <!-- id: 19 -->
  - [x] Add Date Display Format selection control to `SettingsPage.tsx` with Bullet Journal format options (`AUG 05 WED`, `05/08 QUA`, `05-08-2026 WED`, etc.) <!-- id: 20 -->
  - [x] Write unit tests for date formatting and preferences setting <!-- id: 21 -->

- [x] Verification & Automated Tests <!-- id: 22 -->
  - [x] Run `docker compose exec api npm test` <!-- id: 23 -->
  - [x] Run `docker compose exec app npm test` <!-- id: 24 -->
  - [x] Perform visual verification on browser at `https://antigravity.planner.local` <!-- id: 25 -->
