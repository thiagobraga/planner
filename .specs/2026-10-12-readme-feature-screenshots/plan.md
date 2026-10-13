# README features with screenshots

## Problem

The Features list in the README is plain text. Readers cannot see what Planner looks like. Some bullets describe implementation details (glassmorphic blur, React Router) and four bullets cover one offline story.

## Goals

- Each main feature has a short line and a screenshot.
- The list is shorter and about what the user gets, not how it is built.
- Images live in the repo and render on GitHub in light and dark mode.

## User-visible behavior

- README Features section shows a few feature blocks: a screenshot, a title, one or two lines.
- Screenshot blocks: Daily list, Daily Kanban, Habits. Text-only blocks: Offline and real-time sync, Connect AI agents (API tokens and MCP).
- Each screenshot exists for desktop and mobile, light and dark: 3 screens x 2 x 2 = 12 images.
- Offline bullets merge into one block.
- The React Router and glassmorphic bullets are dropped.

## Decisions

- Screenshots are stored in `.github/assets/`, outside the app.
- Screens: Daily list, Daily Kanban, Habits.
- Viewports: desktop (1440x900) and mobile.
- Themes: light and dark, switched with `<picture>` and `prefers-color-scheme`.
- Data: a clean account with fictional tasks, habits and collections.

## Open questions

- Mobile viewport size (suggest 390x844).
- Do desktop and mobile show side by side in one block or stacked?

## Non-goals

- Changing app UI.
- Adding a docs site.

## Relevant files

- `README.md` (Features section)
- `.github/assets/*.png` (new)
