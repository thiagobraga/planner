# Help Page Prompt — Implementation Plan

## Goal

Create a detailed prompt that you can paste into ChatGPT to generate a **Help page UI** for the Planner app. The prompt will describe all Planner features with usage instructions so ChatGPT can produce a complete Help page.

---

## Research Summary

I've thoroughly read the entire codebase (**~50 files** across pages, components, hooks, stores, types, API routes, CSS, and docs). Here's a condensed summary of everything discovered:

### Pages & Views

| Page | Key Features |
|------|-------------|
| **Inbox** | Default capture location for unassigned tasks. List view with drag-and-drop reordering, inline editing, indent/outdent nesting (up to 5 levels), task/note type toggle. |
| **Daily** | Shows today's tasks + overdue from past dates, grouped by date section (labeled "JUL 19 SAT"). `StripNavigator` for quick date jumping. Supports notes (prefix `-`). Tasks show collection badges. |
| **Upcoming** | Next 7 days preview with tasks grouped by date. Read-only prototype with seed data. |
| **Monthly** | Ledger-style calendar — each day is a row showing `[day | weekday | notes]`. `MonthSelector` for navigation. Today highlighted, weekends styled, future days dimmed. |
| **Habits** | Two views: **Timeline** (rows × day columns with chain connectors) and **Calendar** (monthly dot-grid cards). Sub-habits, habit groups, streak counting. Chain = consecutive non-empty days joined by 2px connector. |
| **Collections** | Hierarchical project/list tree (max depth 4). Breadcrumb navigation. 20 palette colors with auto-shaded sub-collection colors. Drag to reorder or re-parent. |
| **Settings** | Font switcher (Lora/Playpen Sans/Hubballi), small caps toggle, background color (beige/white), dot grid toggle. Auto-saves on change. |
| **Login** | Email + password auth. Register and login modes. Dev hint in development mode. |

### Task System

- **Types:** Tasks (`•` bullet) and Notes (`-` indicator)
- **Priority:** P1 (brick red), P2 (orange), P3 (blue), P4 (ink/default)
- **Status:** Open, In Progress, Done, Blocked (with colored pills)
- **Fields:** Title, description, due date, priority, status, collection, labels/tags, parent task, depth
- **Inline editing:** Click to edit, Enter commits + adds below, Escape cancels, empty = delete
- **Completion:** Click bullet toggles `•` → `×` with line-through + dimming
- **Drag-and-drop:** Reorder within lists, move between date sections, drag onto sidebar collections
- **Indentation:** Tab/Shift+Tab to nest/unnest tasks (up to 5 levels deep)

### Habit System

- **Habits** with optional parent/child hierarchy (sub-habits)
- **Habit Groups** for organizing habits into named sections
- **Dot states:** Empty (outline), Half (partial sub-habit completion), Full (solid fill)
- **Chain visualization:** Consecutive completed/partial days joined by connector lines
- **Two views:** Timeline (horizontal grid) and Calendar (monthly dot-grid cards per habit)
- **Drag-and-drop:** Reorder habits, move between groups

### Collection System

- Hierarchical tree (up to 4 levels deep)
- 20 palette colors with 4-shade families for sub-collections
- Drag-and-drop reordering and re-parenting
- Inline rename, context menu actions
- Collaboration: invite users by email, manage collaborators, assign tasks

### Additional Features

- **Search** (`/` or `⌘K`): Command-palette search across tasks, collections, labels. Min 2 chars, keyboard navigable.
- **Filter Bar**: Syntax-highlighted filter input with tokenizer. Keywords: `today`, `overdue`, `no date`, `p1`–`p4`, `assigned to: me`. Collection refs (`#name`), label refs (`@name`), date filters (`due before|after: YYYY-MM-DD`), logic operators (`&`, `|`, `!`).
- **QuickAdd** (`Q`): Modal with NLP date parsing ("today", "tomorrow", "next Monday", "in 3 days").
- **Context Menu**: Right-click on tasks, collections, habits. Actions vary by context.
- **Labels/Tags**: Ad-hoc string tags displayed as chips.
- **Comments**: Add/edit/delete comments on tasks.
- **Reminders**: Set remind-at timestamps on tasks.
- **Sections**: Organize tasks within collections into named sections.
- **Activity Feed**: Chronological activity log, filterable by collection.
- **Saved Filters**: Create, update, delete named filter queries.
- **Data Export**: Export all user data as JSON.
- **Collaboration**: Invite users to collections, manage collaborators, assign tasks.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Q` | Open QuickAdd |
| `/` | Open Search |
| `?` | Toggle Help panel |
| `Enter` | Edit selected task |
| `Delete` | Delete selected task (confirm) |
| `Escape` | Close any dialog |
| `G` then `I` | Navigate to Inbox |
| `G` then `T` | Navigate to Daily |
| `G` then `U` | Navigate to Upcoming |
| `↑` / `↓` | Navigate between tasks |
| `Tab` / `Shift+Tab` | Indent / Outdent task |
| `Space` | Toggle task completion |

### Design System

- **Paper journal metaphor** — cream paper surface with 24px dot grid
- **Colors:** Cream `#f5f0e8`, Ink `#44443d`, Brick Red accent `#c9483b`, plus warm neutrals
- **Typography:** Lora serif everywhere (3 switchable fonts: Lora, Playpen Sans, Hubballi)
- **Type scale:** Display (48px), Heading (22px), Body (16px), Caption (12px), Label (11px uppercase spaced), Mono (12px)
- **Elevation:** Tint-based depth (no heavy shadows), 3 shadow tokens (subtle/medium/overlay)
- **Motion:** 150ms/200ms/300ms, ease-out, no bounce/spring
- **PWA:** Installable on all devices
- **Offline:** IndexedDB-backed mutation queue, background sync with ID remapping
- **Real-time sync:** WebSocket-based live updates across tabs/devices

---

## Open Questions

> [!IMPORTANT]
> ### Decisions needed before I write the prompt
>
> **1. Output format:** Should the prompt instruct ChatGPT to generate:
>    - **(a)** A static **HTML/CSS page** ready to drop into the app?
>    - **(b)** A **design mockup description** / wireframe?
>    - **(c)** Just the **content/copy** for a Help page (text only)?
>
> **2. Design fidelity:** Should I include Planner's full design system (Lora font, cream colors, dot grid, exact CSS tokens) so ChatGPT's output visually matches the app? Or keep it generic for you to style later?
>
> **3. Content depth:** 
>    - **(a)** Comprehensive — document every feature, shortcut, and micro-interaction
>    - **(b)** Curated — focus on main workflows (getting started, daily planning, habits, collections) and a shortcuts reference
>
> **4. Help page sections:** I'm planning these — add, remove, or reorder as you like:
>    1. Welcome / What is Planner
>    2. Getting Started (creating tasks, QuickAdd)
>    3. Task Management (editing, priorities, statuses, notes, nesting)
>    4. Views (Inbox, Daily, Upcoming, Monthly)
>    5. Habits (tracking, chains, sub-habits, groups, views)
>    6. Collections & Tags
>    7. Search & Filters
>    8. Keyboard Shortcuts
>    9. Offline Mode & Sync
>    10. Settings & Customization
>    11. PWA Installation

## Proposed Deliverable

A single artifact file `help_page_prompt.md` containing the complete, ready-to-paste ChatGPT prompt. The prompt will be structured to produce a Help page covering all the sections above, with accurate feature descriptions and usage instructions drawn from the codebase research.

## Verification Plan

### Manual Verification
- Paste the prompt into ChatGPT and verify it produces a comprehensive, accurate Help page
- Cross-check output against the app to ensure no features are missed or misrepresented
