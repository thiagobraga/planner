# Feature: Admin Feature Comparison Table

## Overview
A new admin page at `/admin/compare` that displays a comprehensive feature comparison table between Planner and popular todo/task management applications. This helps admins understand Planner's position in the market and identify gaps or strengths.

## User Perspective
As an admin, I want to see a side-by-side comparison of Planner features versus other popular todo apps (Todoist, Habitica, Microsoft To Do, Google Tasks, Remember the Milk, and optionally Jira) so I can understand competitive positioning and plan future features.

## Key Requirements
- New route `/admin/compare` accessible only to admins
- Large, well-designed table following Planner's design system (warm cream, Lora serif, dotted grid)
- Comparison across multiple feature categories:
  - Core task management
  - Habit tracking
  - Project/collection organization
  - Recurring tasks
  - Reminders/notifications
  - Collaboration/sharing
  - Integrations/API
  - Platform availability
  - Pricing model
- Each competitor as a column, Planner as the first column
- Visual indicators: ✓ (has), ✗ (missing), ~ (partial), ? (unknown)
- Responsive design (horizontal scroll on mobile)
- Follows existing admin page patterns (page-header-copy, sticky header, etc.)

## Relevant Files
- `app/src/pages/admin/AdminComparePage.tsx` (new)
- `app/src/App.tsx` (add route)
- `app/src/components/Sidebar.tsx` (add nav link)
- `app/src/i18n/locales/en.ts` (add translations)
- `app/src/i18n/locales/pt-BR.ts` (add translations)