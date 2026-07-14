# Refine Planner Behavior

You are a skilled Web Developer and Design Expert. Let's think this project like a real Bullet Journal. But with small features that help day-to-day tasks, ADHD brains. For now, we will do some internal changes and improvements on the project.

## Features

- Implement projects page
  - It should look the same as the other pages like Daily, but only with tasks from that project
  - Add some projects and tasks as example
  - Let user reorder projects, nest projects, rename, delete (with confirmation), add with ease
  - Save projects on db of course

## Possible breaking changes

- Let's use Webpack with HMR and sourcemaps enabled on development only
  - Update Dockerfile if needed but I don't think so
- I prefer that you use Tailwind v4 if possible, and avoid using lots of inline styles on elements

## Fixes

- Tasks on daily pages are not auto-repeating tasks. Fix that if this is still occuring
- "Add task..." placeholder should be as light as completed tasks
- The "x" for completed task should be a little bigger

## Improvements

- for kbd's padding 0 5px
  <kbd style="padding: 0 5px;background...
- Make CSS beautiful, modern, performatic, use new CSS nested elements
- Move body background CSS rules to .main-content

## System

- Make API and db for planner accessible from api.planner.local and db.planner.local
  - I already added to /etc/hosts
  - Add traefik labels like other projects
  - If using Postgres, create a container for pgadmin latest
  - Use a default root pass and user with automatic access to pgadmin (development only)
