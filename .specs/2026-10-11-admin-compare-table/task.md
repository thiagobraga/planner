# Task: Admin Feature Comparison Table

## Implementation Tasks

### 1. Create the AdminComparePage component
- [ ] Create `app/src/pages/admin/AdminComparePage.tsx`
- [ ] Follow admin page patterns (page-header-copy, sticky header, Section/Tile components)
- [ ] Define feature comparison data structure
- [ ] Build responsive table with horizontal scroll
- [ ] Use design system colors, typography, spacing
- [ ] Add visual indicators (✓, ✗, ~, ?) with proper styling

### 2. Add route to App.tsx
- [ ] Import AdminComparePage
- [ ] Add Route `/admin/compare` with admin guard

### 3. Add sidebar navigation
- [ ] Add CompareTableIcon to Sidebar.tsx
- [ ] Add nav link in both collapsed and expanded sidebar modes
- [ ] Use translation key `nav.adminCompare`

### 4. Add i18n translations
- [ ] Add English translations in `app/src/i18n/locales/en.ts`
- [ ] Add Portuguese translations in `app/src/i18n/locales/pt-BR.ts`

### 5. Run lint and tests
- [ ] Run `docker compose exec app npm run lint`
- [ ] Run `docker compose exec app npm test`
- [ ] Verify no regressions

### 6. Create draft PR
- [ ] Commit changes with conventional commits
- [ ] Push to remote
- [ ] Open draft PR

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