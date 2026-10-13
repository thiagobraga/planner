# README features with screenshots

## Problem

The Features list in the README is plain text. Readers cannot see what Planner looks like. Some bullets describe implementation details (glassmorphic blur, React Router) and four bullets cover one offline story.

## Goals

- Each main feature has a short line and a screenshot.
- The list is shorter and about what the user gets, not how it is built.
- Images live in the repo and render on GitHub in light and dark mode.

## User-visible behavior

- README Features section shows a few feature blocks: a screenshot, a title, one or two lines.
- Planned blocks: Daily (list and Kanban), Monthly, Habits, Collections and filters, Offline and real-time sync, Connect AI agents (API tokens and MCP).
- Offline bullets merge into one block.
- The React Router and glassmorphic bullets are dropped.

## Decisions

- Screenshots are stored in `.github/assets/`, outside the app.

## Open questions

- Which screens exactly, and desktop only or also mobile?
- Light theme only, or light and dark side by side?
- Demo data: use seed data from a clean dev stack, or a prepared account?

## Non-goals

- Changing app UI.
- Adding a docs site.

## Relevant files

- `README.md` (Features section)
- `.github/assets/*.png` (new)
