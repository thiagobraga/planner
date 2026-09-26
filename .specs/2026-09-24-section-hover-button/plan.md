# Show "+ Nova seção" (+ New section) Only on Hover

## Problem

The "+ Nova seção" ("+ New section") button at the end of task lists and timeline rows is currently rendered with `opacity-35` at all times, making it faintly visible even when the user is reading through tasks. The user wants the button to be hidden by default and only revealed when hovered.

## What the user wants

1. The "+ Nova seção" ("+ New section") button should be invisible (`opacity-0`) by default.
2. When the user hovers over the button (or focuses it via keyboard navigation for accessibility), it should smoothly appear (`opacity-100`).
3. This applies across all views where "+ Nova seção" appears:
   - Inbox view (`app/src/pages/InboxPage.tsx`)
   - Collections / Projects view (`app/src/pages/CollectionsPage.tsx`)
   - Habits timeline view (`app/src/components/habits/HabitTimeline.tsx`)

## Relevant Files

- `app/src/pages/InboxPage.tsx` - Inbox section list and "+ New section" trigger
- `app/src/pages/CollectionsPage.tsx` - Collection section list and "+ New section" trigger
- `app/src/components/habits/HabitTimeline.tsx` - Habit timeline and "+ New section" group trigger
- `app/src/pages/__tests__/InboxPage.sections.test.tsx` - Tests for section creation in Inbox
- `app/src/pages/__tests__/CollectionsPage.test.tsx` - Tests for Collections page
- `app/src/components/habits/__tests__/HabitTimeline.test.tsx` - Tests for HabitTimeline
