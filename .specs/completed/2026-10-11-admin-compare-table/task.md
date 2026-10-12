# Task: Admin Feature Comparison Table

## Implementation Tasks

### 1. Create the AdminComparePage component
- [x] Create `app/src/pages/admin/AdminComparePage.tsx`
- [x] Follow admin page patterns (page-header-copy, sticky header, Section/Tile components)
- [x] Define feature comparison data structure
- [x] Build responsive table with horizontal scroll
- [x] Use design system colors, typography, spacing
- [x] Add visual indicators (✓, ✗, ~, ?) with proper styling

### 2. Add route to App.tsx
- [x] Import AdminComparePage
- [x] Add Route `/admin/compare` with admin guard

### 3. Add sidebar navigation
- [x] Add CompareTableIcon to Sidebar.tsx
- [x] Add nav link in both collapsed and expanded sidebar modes
- [x] Use translation key `nav.adminCompare`

### 4. Add i18n translations
- [x] Add English translations in `app/src/i18n/locales/en.ts`
- [x] Add Portuguese translations in `app/src/i18n/locales/pt-BR.ts`

### 5. Run lint and tests
- [x] Run `docker compose exec app npm run lint`
- [x] Run `docker compose exec app npm test`
- [x] Verify no regressions

### 6. Create draft PR
- [x] Commit changes with conventional commits
- [x] Push to remote
- [x] Open draft PR

## Feature Comparison Data

### Competitors
1. **Planner** (this app)
2. **Todoist**
3. **Habitica**
4. **Microsoft To Do**
5. **Google Tasks**
6. **Remember the Milk**
7. **Jira** (future consideration)

### Feature Categories
- Core Task Management
- Habit Tracking
- Projects/Collections
- Recurrence
- Reminders
- Collaboration
- Integrations/API
- Platforms
- Pricing