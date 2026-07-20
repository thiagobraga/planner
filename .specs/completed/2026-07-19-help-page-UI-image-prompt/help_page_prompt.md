# ChatGPT Prompt — Planner Help Page UI Mockup

> Copy everything below the line and paste it into ChatGPT (with image generation enabled).

---

Generate a **high-fidelity UI design mockup image** of a Help page for a web application called **Planner** — a Bullet Journal-inspired task manager.

## Design System (follow exactly)

**Creative direction:** The app looks like a Moleskine page that happens to compute. The surface is warm cream paper with a subtle 24px dot grid. Everything reads as ink on paper, not pixels on glass.

**Colors:**
- Page background: warm cream `#f5f0e8` with a faint dot grid pattern (dots are `#d8d3cb`, spaced 24px apart)
- Sidebar background: slightly deeper cream `#ebe6de`
- Primary text ("ink"): `#44443d` — never pure black
- Secondary text: `#8b867e`
- Muted/disabled text: `#c5c1ba`
- Borders/dividers: `#e5e1d8` — thin 1px hairlines that read as paper creases
- Accent (sparingly): warm brick red `#c9483b` — used only for important callouts, max 10% of screen
- Success/done: soft moss green `#8ca46a`

**Typography:**
- **One serif font everywhere:** Lora (Google Font), with Georgia as fallback. No sans-serif anywhere.
- Page title: Lora 600 (semibold), 22px
- Section headings: Lora 600, 18px
- Body text: Lora 400, 14–16px, line-height 24px
- Caption/secondary text: Lora 400, 12px, in secondary text color
- Labels/dividers: Lora 500, 11px, UPPERCASE, letter-spacing 0.1em — this is the only place uppercase appears
- Keyboard shortcut keys: monospace font, 10–11px, inside small rounded `kbd` chips with dot-grey `#d8d3cb` background

**Elevation:** Mostly flat. Depth conveyed through tint layering (cream → deeper cream → dot grey), not shadows. Shadows are soft, warm-tinted, and rare. No glassmorphism, no hard shadows.

**Corners:** 4–8px border radius. Nothing overly rounded.

**Motion/feel:** Quiet, restrained, editorial. No flashy gradients or decorative elements. The dot grid showing through the page IS the decoration.

## Page Layout

The mockup should show a **desktop viewport** (~1280px wide) with three columns:

### Left Sidebar (220px, fixed)
The app's existing navigation sidebar on `#ebe6de` background:
- **Top:** A small app icon + "Planner" title in serif
- **Nav items** (vertically stacked, 32px tall each, 4px rounded):
  - Daily (with a bullet-journal task icon)
  - Inbox
  - Monthly
  - Habits
- **Collections section** below nav, with a "COLLECTIONS" uppercase label divider, showing 2–3 example collections with small colored dots (e.g., "Development" with a green dot, "Health" with a yellow dot)
- **Bottom:** Settings link, a "Help" link (this one should appear **active** — with a subtle `rgba(212,207,199,0.5)` background highlight)
- Small keyboard hint at the very bottom: `?` in a `kbd` chip + "Help" caption

### Main Content (flexible width, scrollable)
The Help page content on the cream `#f5f0e8` background with the dot grid showing through. Generous padding (32px sides). Max content width ~640px, centered.

**Page header (sticky):**
- Title: "Help" in Lora 600, 22px
- Subtitle: "Learn how to use Planner" in secondary text color, 14px

**Sections** (each separated by generous whitespace, ~32px):

#### 1. WELCOME (uppercase label divider)
A short paragraph: "Planner is a Bullet Journal-inspired task manager designed to help you organize your day with focus and clarity. It supports daily planning, habit tracking, collections, and works offline."

#### 2. GETTING STARTED
- **Creating tasks:** "Type in the task input at the bottom of any page and press Enter. Use the QuickAdd shortcut (`Q`) for natural language dates — try 'tomorrow' or 'next Monday'."
- **Completing tasks:** "Click the bullet `•` to mark a task done. It becomes `×` with a line-through."
- **Editing:** "Click any task to edit inline. Press Enter to save, Escape to cancel."
- **Task types:** "Tasks show a `•` bullet. Notes show a `–` dash — press `-` in an empty input to create one."

#### 3. VIEWS
Brief descriptions in a clean list:
- **Daily** — "Your daily page. Shows today's tasks plus any overdue items, grouped by date."
- **Inbox** — "The default capture spot for tasks not yet assigned to a collection."
- **Monthly** — "A ledger-style month view. Each day is a row showing its date and notes."
- **Upcoming** — "A 7-day lookahead of what's scheduled next."

#### 4. HABITS
- "Track daily habits in **Timeline** view (rows of dots across the month) or **Calendar** view (dot-grid cards)."
- "Click a dot to log completion. Consecutive days form an **unbroken chain** — connected by a visible line."
- "Organize habits into **groups** and nest **sub-habits** under parent habits."

#### 5. COLLECTIONS & TAGS
- "Create collections (projects) to group related tasks. Collections can be nested up to 4 levels deep."
- "Drag tasks onto collections in the sidebar to file them."
- "Add tags as `@label` chips to classify tasks."

#### 6. KEYBOARD SHORTCUTS
A clean 2-column table with `kbd`-styled keys:

| Key | Action |
|-----|--------|
| `Q` | Quick add task |
| `/` | Search |
| `?` | Toggle this help |
| `G` then `I` | Go to Inbox |
| `G` then `T` | Go to Daily |
| `G` then `U` | Go to Upcoming |
| `↑` `↓` | Navigate tasks |
| `Enter` | Edit selected task |
| `Space` | Toggle completion |
| `Tab` | Indent task |
| `Escape` | Close dialog |

The keys should be rendered inside small rounded chips with a dot-grey background, monospace font — like physical keyboard caps.

#### 7. SETTINGS
- "Choose your font: **Lora** (serif), **Playpen Sans** (handwriting), or **Hubballi** (script)."
- "Toggle the dot-grid background, switch between beige and white themes, or enable small caps."

### Right Sidebar — Table of Contents (200px, sticky)
A sticky right-side panel on the same cream background, slightly separated by a 1px border on the left. Contains:

- **"ON THIS PAGE"** — uppercase label (11px, spaced, `#8b867e`)
- Vertically stacked TOC links (Lora 400, 13px, secondary text color, 28px line-height):
  - Welcome
  - Getting Started
  - Views
  - Habits
  - Collections & Tags
  - Keyboard Shortcuts
  - Settings
- The currently visible section (e.g., "Getting Started") should be highlighted with ink-color text and a subtle 2px left border in `#44443d`

## Important Style Rules
- No sans-serif fonts anywhere — Lora serif only (except `kbd` keys which use monospace)
- No pure white (`#fff`) or pure black (`#000`) — everything is warm-tinted
- The brick-red accent `#c9483b` appears sparingly — only on the occasional important callout or inline accent, never as a background or hero color
- The dot grid pattern should be subtly visible through the main content area
- Borders are 1px, warm-tinted (`#e5e1d8`), never heavy
- The overall feel should be: calm, editorial, like reading a beautifully typeset reference page in a paper journal
