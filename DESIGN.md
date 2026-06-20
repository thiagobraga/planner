---
name: Planner
description: Editorial planner that reads like a paper journal.
colors:
  cream: "#f5f0e8"
  sidebar-bg: "#ebe6de"
  ink: "#2c2c2c"
  ink-light: "#6b6b6b"
  dot: "#d4cfc7"
  accent: "#c0392b"
  accent-light: "#e74c3c"
  priority-2: "#e67e22"
  priority-3: "#3498db"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  headline:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  numeric:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: "56px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
  caption:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0.1em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  pill: "8px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 16px"
  sidebar-link:
    backgroundColor: "{colors.sidebar-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  sidebar-link-active:
    backgroundColor: "{colors.dot}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  task-row:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "24px"
  chip-label:
    backgroundColor: "{colors.dot}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
  input-text:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  overlay-panel:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px 32px"
  habit-dot:
    backgroundColor: "{colors.ink}"
    width: "16px"
    height: "16px"
---

# Design System: Planner

## 1. Overview

**Creative North Star: "The Paper Journal"**

Planner is a Moleskine page that happens to compute. The surface is warm cream stock printed with a 24-pixel dotted grid; everything that lives on the page should look like ink laid onto paper, not pixels rendered on glass. Lora serif carries every word, headings to checkboxes, because a single typographic voice is what makes a paper journal feel like one object. A single brick-red accent stands in for the red felt-tip; it appears only when the page wants the reader's eye to stop.

The system explicitly rejects the visual idioms of its category: Todoist's saturated red field, Things' iOS-default sans, Notion's neutral grey, Linear's terminal density, and the SaaS-cream-with-rounded-cards template that most planning apps default to. Density is moderate but not cramped; rhythm is set by the 24-pixel baseline grid, the same grid the body dot pattern is printed on. Depth is conveyed through tint and stroke, never shadow.

**Key Characteristics:**
- Cream paper surface (`#f5f0e8`) with a printed dot grid (`#d4cfc7`, 24px spacing) as the page texture
- One serif (Lora) for everything; no display/body pairing
- Tinted-warm neutrals only; the single brick-red accent appears on ≤10% of any screen
- Flat by default; depth from tint, stroke, and the dot grid itself
- 24px vertical rhythm; row heights, line heights, and label heights all snap to it

## 2. Colors

A short palette of warm, slightly aged neutrals with one brick-red anchor; everything tilts toward yellow-red hue. No greys, no blue-grey, no pure black or white.

### Primary
- **Warm Brick Red** (`#c0392b`, `oklch(50% 0.18 30)`): The single accent. Reserved for state that needs the eye to stop: overdue indicators, P1 priority bullets, error glyphs, the active caret. Decorative use is forbidden.
- **Felt-Tip Red** (`#e74c3c`, `oklch(60% 0.20 30)`): A lifted variant of the brick red. Available for hover or emphasis on the primary, but currently appears as the P2-adjacent option; treat as situational, not free-to-use.

### Neutral
- **Cream Paper** (`#f5f0e8`, `oklch(95% 0.012 70)`): The page itself. Body background, overlay panel surface, input field surface. Never `#fff`.
- **Sidebar Cream** (`#ebe6de`, `oklch(91% 0.012 70)`): A half-step deeper than Cream Paper, used for sidebars, toolbars, and tonal layering. The only secondary surface.
- **Dot Grey** (`#d4cfc7`, `oklch(84% 0.012 70)`): Borders, dividers, chip backgrounds, drag-handle resting color, the printed dot grid. The workhorse neutral; appears more often than any other color.
- **Ink** (`#2c2c2c`, `oklch(28% 0.005 60)`): All primary text. The "ink" of the journal. Never `#000`.
- **Ink Light** (`#6b6b6b`, `oklch(48% 0.005 60)`): Secondary text, captions, italics, due-date labels, empty-state copy, kbd hints.

### Tertiary (priority data only)
- **Pencil Orange** (`#e67e22`): P2 priority bullets only.
- **Annotation Blue** (`#3498db`): P3 priority bullets only.

### Named Rules

**The One Voice Rule.** The brick-red accent (`#c0392b`) appears on ≤10% of any screen. Its rarity is the point: when it shows up, something needs the eye. Using it as a decorative trim, a hover state on something benign, or a hero color is forbidden.

**The No-Pure Rule.** No `#fff`, no `#000`. Every neutral is tinted toward the warm hue (yellow-red, around hue 60–70 in OKLCH). The body background is Cream Paper, not white. Text is Ink, not black.

**The Tertiary Restraint Rule.** Pencil Orange and Annotation Blue exist only on priority bullets inside a task row. They are not free-to-use accent colors. They never appear as backgrounds, borders, or text.

## 3. Typography

**Display Font:** Lora (with Georgia, serif fallback)
**Body Font:** Lora (with Georgia, serif fallback)
**Mono Font:** `ui-monospace, SFMono-Regular, monospace` (for keyboard caps only)

**Character:** One serif, used everywhere. Lora is a contemporary book-weight serif with calligraphic roots; it gives the interface the feel of handwritten ink without looking precious. The decision to use it on buttons, labels, and chips, places where most product UIs default to a clean sans, is what makes the system feel like a paper journal instead of a paper-themed app.

### Hierarchy
- **Numeric** (Lora 600, 56px / 56px, `letter-spacing: -0.02em`): Reserved for hero numerical readouts. Used on the Habits page for the unbroken-chain count. Do not use for body figures, prices, or stats inside a card.
- **Display** (Lora 600, 18px / 24px): Page titles. "MAY 13 WED", "Habits", "Inbox".
- **Headline** (Lora 600, 16px / 24px): Section titles inside a page; secondary headings inside overlay panels.
- **Body** (Lora 400, 14px / 24px): Task titles, prose, default text. 24px line height locks to the baseline grid.
- **Caption** (Lora 400, 12px / 24px): Due dates, italic sub-notes, empty states. Italics are part of this style.
- **Label** (Lora 500, 11px / 24px, `letter-spacing: 0.1em`, UPPERCASE): Section dividers ("OVERDUE", "TODAY", "PROJECTS"). The only uppercase style in the system.
- **Mono** (monospace, 11px / 16px): Keyboard caps inside the help panel and the sidebar footer hints. Nothing else.

### Named Rules

**The One Serif Rule.** Lora carries everything: headlines, body, buttons, labels, chips. No sans. No second display font. If a UI element needs differentiation, it gets weight, size, case, or letter-spacing, not a different family.

**The Baseline Rule.** Body line-height is 24px; row heights snap to 24px or 32px; section dividers are 24px tall. The page dot grid is printed at 24px. Every vertical measurement is a multiple of 4, and rhythm-critical ones are multiples of 24.

**The Spaced-Cap Label Rule.** Labels (11px) get `letter-spacing: 0.1em` and UPPERCASE. This is the only place the system uses uppercase. Don't apply it elsewhere; don't drop it from labels.

## 4. Elevation

Flat. There are no resting shadows in the system. Depth is carried by three mechanisms, in order of frequency: (1) tint, by stepping a surface one notch deeper than its parent (Sidebar Cream against Cream Paper, Dot Grey against Sidebar Cream); (2) hairline stroke (1px Dot Grey) between sections; (3) the printed dot grid showing through, which signals "this is the page surface, not a card."

### Shadow Vocabulary
- **Overlay drop** (`box-shadow: 0 8px 32px rgba(44,44,44,0.15)`): The only shadow in the system. Used exclusively on modal overlays (search, keyboard-shortcuts dialog) and only when they are floating over a dimmed page. The shadow is large, soft, and warm-tinted; it reads like the panel is a sheet of paper resting on the journal, not a glassmorphic chip floating in space.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. No card shadows, no resting elevation, no soft drop-shadows on hovers. If a surface needs to read as "above" another, deepen its tint or add a 1px Dot Grey border, don't shadow it.

**The Page-Shows-Through Rule.** Cards, containers, and panels that sit on the body background must NOT cover the dot grid with an opaque fill except when explicitly elevated (overlays). The grid showing through is the system's primary signal that the surface is "the page."

## 5. Components

### Buttons
- **Shape:** Lightly rounded (4px, `rounded.sm`).
- **Primary:** Ink fill (`#2c2c2c`) on Cream Paper text, Lora 14px, padding `4px 16px`. Used sparingly: dialog confirms, destructive confirms.
- **Default action affordance:** Most "buttons" in the system are actually serif text links or low-emphasis inline triggers; the heavy primary button is reserved for moments that need closure.
- **Hover / Focus:** No transform, no shadow. State conveyed through a 150ms opacity or background tint change.

### Task Row (signature)
- **Layout:** A 24px-tall horizontal row. Drag handle (hidden until row-hover), bullet (24px column), serif title (14px), italic due date, label chips.
- **Bullet:** A single typographic glyph: `•` (priority color) when active, `×` (Ink) when completed. No checkbox box.
- **Selected state:** `rgba(212,207,199,0.6)` background (Dot Grey at 60% alpha).
- **Hover:** `rgba(212,207,199,0.4)` background.
- **Completed state:** Title gets `line-through` and opacity 0.35.

### Sidebar Link
- **Shape:** 32px tall, 4px corner radius, padded `0 12px`.
- **Default:** Transparent on Sidebar Cream, Ink text at 60% opacity.
- **Hover:** Opacity rises to 100%.
- **Active:** Background `rgba(212,207,199,0.5)` (Dot Grey at 50%), text at 100% with `font-weight: 500`. No bar, no stripe, no arrow.

### Chips (labels)
- **Style:** Dot Grey background, Ink text, 8px pill radius, padding `0 6px`. 10–11px font.
- **No bordered chip variants.** Filter chips and label chips both use this single style.

### Inputs / Fields
- **Style:** 1px Dot Grey border, 4px radius, Cream Paper background, Lora 13–14px, Ink text.
- **Focus:** Border darkens to Ink. No glow, no ring.
- **Error:** Border to Warm Brick Red. No background tint, no icon.
- **Caret animation:** The active task-input gets a 1.2s caret-blink keyframe (`caret-color` transitions Ink → transparent), reinforcing "you're writing in this journal."

### Overlay Panel (modals)
- **Surface:** Cream Paper, 6px radius, 1px Dot Grey border, padding `24px 32px`.
- **Backdrop:** `rgba(44,44,44,0.3)` with a 2px backdrop-blur. The blur is intentional and minimal; not glassmorphism.
- **Shadow:** The single overlay drop (see Elevation).
- **Dismissal:** Click backdrop or Escape. No close X by default; if needed, it's a serif "Close" button, not an icon.

### Habit Dot Grid (signature)
- **Cell:** 16×16px circle, 6px gap.
- **Empty:** 1px Dot Grey border, transparent fill.
- **Completed:** Ink fill, no border.
- **The Capsule Rule:** Consecutive completed days in the same row collapse their inner corners (`border-radius` becomes `0` on the adjacent edge), fusing into a single ink capsule. The capsule IS the chain visualization; no connector lines, no flame icons, no streak counters overlaid.
- **Today:** 1.5px Ink ring outline, regardless of completion state.
- **Future:** Renders as empty grid space, no cell drawn.

### Navigation
- **Top-level:** Three primary destinations (Inbox, Daily, Upcoming) plus secondary (Habits, Projects). All in the left sidebar; no top bar.
- **Active state:** See Sidebar Link.
- **Mobile:** Sidebar collapses to a 240px drawer that slides in from the left with a 200ms ease transition. Backdrop dims to `rgba(44,44,44,0.3)`.

## 6. Do's and Don'ts

### Do:
- **Do** lay every vertical measurement onto the 24px (or 4px sub-step) grid. Row heights, line heights, label heights, paddings.
- **Do** use Lora for every text element, including buttons and labels. One serif, everywhere.
- **Do** let the dot grid show through. If a section sits on the body background, do not opaque-fill it.
- **Do** convey depth with tint (Cream → Sidebar Cream → Dot Grey) and 1px Dot Grey hairlines, not shadow.
- **Do** reserve Warm Brick Red for state that requires the eye to stop: overdue, P1, error, active caret. Keep it under 10% of screen surface.
- **Do** render counters and metrics in the Numeric style (Lora 600, 56px, tight letter-spacing) when they earn the weight, like the unbroken-chain count.
- **Do** use the Capsule Rule to fuse consecutive completed habit days into a single ink stroke. The capsule is the chain.
- **Do** style labels as UPPERCASE with `letter-spacing: 0.1em` at 11px. That treatment belongs to labels and nothing else.

### Don't:
- **Don't** use `#fff` or `#000`. Every neutral is tinted warm. Body is Cream Paper, text is Ink.
- **Don't** introduce a sans-serif. No Inter, no system-ui stack, no SF Pro. Lora carries every glyph.
- **Don't** use Warm Brick Red as a decorative trim, a hover background on a benign control, or a hero band. It is a state color, not a brand color.
- **Don't** drop a card shadow on a resting surface. No `box-shadow` outside the single overlay-drop value.
- **Don't** use Pencil Orange or Annotation Blue outside priority bullets. They are not free accent colors.
- **Don't** cover the dot grid with opaque card fills on the body surface. The page must read through.
- **Don't** apply `border-left` or `border-right` greater than 1px as a colored stripe on rows, cards, or callouts. Side-stripe borders are forbidden.
- **Don't** use `background-clip: text` with a gradient on any heading or numeric readout. The Numeric style is solid Ink.
- **Don't** reach for a modal first. Inline progressive disclosure (task detail panel, quick-add inline) is the default; modals are for search, shortcuts, and confirmations only.
- **Don't** invent custom scrollbars, custom checkboxes, or custom form controls "for flavor." The system already departs from category convention through type and surface; controls should be quiet.
- **Don't** add bounce, elastic, or spring motion. Transitions are 120–200ms, ease-out, no overshoot.
- **Don't** swap the dotted-paper body background for a flat fill. The grid is the page; without it, the metaphor breaks.
