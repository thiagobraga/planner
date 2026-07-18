---
name: Planner
description: Editorial planner that reads like a paper journal.
colors:
  cream: '#f5f0e8'
  sidebar-bg: '#ebe6de'
  ink: '#44443d'
  ink-light: '#8b867e'
  dot: '#d4cfc7'
  border: '#e5e1d8'
  accent: '#c9483b'
  accent-light: '#e76052'
  priority-2: '#e39133'
  priority-3: '#4d8fd6'
  moss: '#8ca46a'
typography:
  display:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '18px'
    fontWeight: 600
    lineHeight: '24px'
  headline:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '16px'
    fontWeight: 600
    lineHeight: '24px'
  numeric:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '56px'
    fontWeight: 600
    lineHeight: '56px'
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: '24px'
  caption:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: '24px'
  label:
    fontFamily: 'Lora, Georgia, serif'
    fontSize: '11px'
    fontWeight: 500
    lineHeight: '24px'
    letterSpacing: '0.1em'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
    fontSize: '11px'
    fontWeight: 400
    lineHeight: '16px'
rounded:
  xs: '4px'
  sm: '6px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  pill: '8px'
  full: '50%'
shadow:
  subtle: '0 1px 2px rgba(68,68,61,0.06), 0 1px 3px rgba(68,68,61,0.08)'
  medium: '0 4px 12px rgba(68,68,61,0.10)'
  overlay: '0 8px 32px rgba(44,44,44,0.15)'
motion:
  fast: '150ms'
  default: '200ms'
  smooth: '300ms'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.cream}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '4px 16px'
  sidebar-link:
    backgroundColor: '{colors.sidebar-bg}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 12px'
    height: '32px'
  sidebar-link-active:
    backgroundColor: '{colors.dot}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
  task-row:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    height: '24px'
  chip-label:
    backgroundColor: '{colors.dot}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '0 6px'
  input-text:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '4px 8px'
  overlay-panel:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '24px 32px'
  habit-dot:
    backgroundColor: '{colors.ink-lighter}'
    width: '8px'
    height: '8px'
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

- **Warm Brick Red** (`#c9483b`): The single accent. Reserved for state that needs the eye to stop: overdue indicators, P1 priority bullets, error glyphs, the active caret. Decorative use is forbidden.
- **Felt-Tip Red** (`#e76052`): A lifted variant of the brick red. Available for hover or emphasis on the primary, but currently appears as the P2-adjacent option; treat as situational, not free-to-use.

### Neutral

- **Cream Paper** (`#f5f0e8`): The page itself. Body background, overlay panel surface, input field surface. Never `#fff`.
- **Sidebar Cream** (`#ebe6de`): A half-step deeper than Cream Paper, used for sidebars, toolbars, and tonal layering. The only secondary surface.
- **Dot Grey** (`#d4cfc7`): Chip backgrounds, drag-handle resting color, the printed dot grid, tonal fills. The workhorse neutral.
- **Border** (`#e5e1d8`): The default hairline for card, panel, input, and divider strokes. A touch lighter/warmer than Dot Grey so 1px edges read as paper creases, not lines.
- **Ink** (`#44443d`): All primary text. The "ink" of the journal. Never `#000`.
- **Ink Light** (`#8b867e`): Secondary text, captions, italics, due-date labels, empty-state copy, kbd hints.

### Tertiary (priority data only)

- **Pencil Orange** (`#e39133`): P2 priority bullets only.
- **Annotation Blue** (`#4d8fd6`): P3 priority bullets only.
- **Soft Moss** (`#8ca46a`): Success / "Done" status only (completed status pills, positive confirmations). Like the tertiary priority colors, it is not a free-to-use accent.

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
- **Label** (Lora 500, 11px / 24px, `letter-spacing: 0.1em`, UPPERCASE): Section dividers ("OVERDUE", "TODAY", "COLLECTIONS"). The only uppercase style in the system.
- **Mono** (monospace, 11px / 16px): Keyboard caps inside the help panel and the sidebar footer hints. Nothing else.

### Named Rules

**The One Serif Rule.** Lora carries everything: headlines, body, buttons, labels, chips. No sans. No second display font. If a UI element needs differentiation, it gets weight, size, case, or letter-spacing, not a different family.

**The Baseline Rule.** Body line-height is 24px; row heights snap to 24px or 32px; section dividers are 24px tall. The page dot grid is printed at 24px. Every vertical measurement is a multiple of 4, and rhythm-critical ones are multiples of 24.

**The Spaced-Cap Label Rule.** Labels (11px) get `letter-spacing: 0.1em` and UPPERCASE. This is the only place the system uses uppercase. Don't apply it elsewhere; don't drop it from labels.

## 4. Elevation

Mostly flat. Depth is carried first by three quiet mechanisms: (1) tint, by stepping a surface one notch deeper than its parent (Sidebar Cream against Cream Paper, Dot Grey against Sidebar Cream); (2) hairline stroke (1px Border) between sections; (3) the printed dot grid showing through, which signals "this is the page surface, not a card." Shadows are a **last resort**, used sparingly and softly when a card, panel, or modal genuinely needs to lift off the page.

### Shadow Vocabulary

- **Subtle** (`0 1px 2px rgba(68,68,61,0.06), 0 1px 3px rgba(68,68,61,0.08)`): The lightest lift. For cards and grouped panels that should read as a distinct sheet on the page without shouting. Pair with a 1px Border, never replace it.
- **Medium** (`0 4px 12px rgba(68,68,61,0.10)`): For popovers, menus, and raised cards that float above sibling content.
- **Overlay drop** (`0 8px 32px rgba(44,44,44,0.15)`): For modal overlays (search, keyboard-shortcuts dialog) floating over a dimmed page. Large, soft, warm-tinted; reads like a sheet of paper resting on the journal, not a glassmorphic chip.

### Named Rules

**The Quiet-Shadow Rule.** Shadows stay soft, warm-tinted, and low-alpha - Subtle, Medium, or Overlay only, no custom values. Tint and 1px Border remain the primary depth signals; a shadow supplements them, it does not replace the border. No hard, cool, or high-contrast drop shadows; no glassmorphism.

**The Page-Shows-Through Rule.** Cards, containers, and panels that sit on the body background must NOT cover the dot grid with an opaque fill except when explicitly elevated (overlays). The grid showing through is the system's primary signal that the surface is "the page."

## 5. Components

### Buttons

- **Shape:** 40px tall, 8px corner radius (`rounded.md`). A left icon sits 8px before the label.
- **Primary:** Ink fill (`#44443d`), Cream Paper text, Lora 14px. Reserved for the main confirming action; one per view.
- **Secondary:** Transparent fill, 1px Border, Ink text. The default medium-emphasis action.
- **Tertiary (ghost):** No fill, no border; Ink text, hover reveals a Dot Grey tint. For low-emphasis inline actions.
- **Destructive:** Transparent fill, 1px Warm Brick Red border, Brick Red text (and icon). For delete / clear-data actions.
- **Disabled:** Dot Grey tint fill, Ink at ~40% opacity, `cursor: not-allowed`. Applies to any variant.
- **Hover / Focus:** No transform. State conveyed through a 150ms opacity or background-tint change; a Subtle shadow is permitted on raised primary buttons but is not required.

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

- **Style:** 1px Border, 8px radius, Cream Paper background, Lora 13–14px, Ink text, 40px tall. A leading icon (e.g. search `⌕`) sits 8px before the value.
- **Focus:** Border darkens to Ink. No glow, no ring.
- **Error:** Border to Warm Brick Red, plus Brick Red help text below. No background tint, no icon.
- **Help text:** Ink Light caption below the field; swaps to Brick Red in the error state.
- **Select:** Same shell as a text input with a trailing chevron. A styled native `<select>`, not a bespoke popup.
- **Caret animation:** The active task-input gets a 1.2s caret-blink keyframe (`caret-color` transitions Ink → transparent), reinforcing "you're writing in this journal."

### Checkbox, Radio, Toggle

- **Checkbox:** A real 16px box, 4px radius, 1px Border. Checked = Ink fill with a Cream check glyph. Used for multi-select settings and task-list options ("Show completed"), not for the signature task-row bullet.
- **Radio:** A 16px circle, 1px Border. Selected = Ink ring with a small Ink center dot.
- **Toggle:** A pill switch (`role="switch"`). Off = Dot Grey track, Cream knob; On = Ink track, Cream knob. 150ms ease. For binary on/off preferences.
- These wrap a real underlying `<input>` for accessibility; they are the sanctioned custom controls (the "no custom controls for flavor" rule still bars one-off inventions beyond this set).

### Status Pills

- **Style:** Pill (8px radius), Lora 11–12px, tinted background + matching text. One per status.
- **Values:** Open (Dot Grey tint), In progress (Annotation Blue tint), Done (Soft Moss tint), Blocked (Warm Brick Red tint). Distinct from priority bullets and label chips.

### Overlay Panel (modals)

- **Surface:** Cream Paper, 6px radius, 1px Dot Grey border, padding `24px 32px`.
- **Backdrop:** `rgba(44,44,44,0.3)` with a 2px backdrop-blur. The blur is intentional and minimal; not glassmorphism.
- **Shadow:** The single overlay drop (see Elevation).
- **Dismissal:** Click backdrop or Escape. No close X by default; if needed, it's a serif "Close" button, not an icon.

### Habit Day Dot (signature)

One 24×24px cell holds one 8px dot. The same dot renders in both habit views — the
month timeline and the calendar grid — so a habit reads identically in each.

- **Empty:** 1px Dot Grey border, transparent fill.
- **Half:** bottom half filled with Ink Lighter, 1px Dot Grey border. Reserved for a
  parent habit whose sub-habits are only partly done that day. A habit without
  sub-habits is never half.
- **Full:** Ink Lighter fill, no border.
- **The Chain Rule:** Consecutive days with any progress — full **or** half — are
  joined by a 2px Ink Lighter connector drawn from cell edge to cell edge, reading
  as one unbroken stroke. The connector IS the chain visualization; no flame icons,
  no streak counters overlaid. Only an empty day breaks the chain: partial credit
  still keeps the run alive.
- **Future:** Renders as empty grid space, no cell drawn, not clickable.

Implemented once in `HabitDot` and `HabitMonthGrid`; the styleguide specimen drives
those same components rather than copying them.

### Navigation

- **Top-level:** Three primary destinations (Inbox, Daily, Upcoming) plus secondary (Habits, Collections). All in the left sidebar; no top bar.
- **Active state:** See Sidebar Link.
- **Mobile:** Sidebar collapses to a 240px drawer that slides in from the left with a 200ms ease transition. Backdrop dims to `rgba(44,44,44,0.3)`.

## 6. Do's and Don'ts

### Do:

- **Do** lay every vertical measurement onto the 24px (or 4px sub-step) grid. Row heights, line heights, label heights, paddings.
- **Do** use Lora for every text element, including buttons and labels. One serif, everywhere.
- **Do** let the dot grid show through. If a section sits on the body background, do not opaque-fill it.
- **Do** convey depth with tint (Cream → Sidebar Cream → Dot Grey) and 1px Dot Grey hairlines, not shadow.
- **Do** reserve Warm Brick Red for state that requires the eye to stop: overdue, P1, error, active caret. Keep it under 10% of screen surface.
- **Do** render counters and metrics in the Numeric style (Lora 600, 56px, tight letter-spacing) when they earn the weight.
- **Do** use the Chain Rule to join consecutive completed habit days into a single unbroken stroke. The connected run is the chain.
- **Do** style labels as UPPERCASE with `letter-spacing: 0.1em` at 11px. That treatment belongs to labels and nothing else.

### Don't:

- **Don't** use `#fff` or `#000`. Every neutral is tinted warm. Body is Cream Paper, text is Ink.
- **Don't** introduce a sans-serif. No Inter, no system-ui stack, no SF Pro. Lora carries every glyph.
- **Don't** use Warm Brick Red as a decorative trim, a hover background on a benign control, or a hero band. It is a state color, not a brand color.
- **Don't** invent custom shadow values or use hard/cool drop shadows. Shadows are limited to the Subtle, Medium, and Overlay tokens, kept soft and warm, and always supplement (never replace) tint and the 1px Border.
- **Don't** use Pencil Orange or Annotation Blue outside priority bullets. They are not free accent colors.
- **Don't** cover the dot grid with opaque card fills on the body surface. The page must read through.
- **Don't** apply `border-left` or `border-right` greater than 1px as a colored stripe on rows, cards, or callouts. Side-stripe borders are forbidden.
- **Don't** use `background-clip: text` with a gradient on any heading or numeric readout. The Numeric style is solid Ink.
- **Don't** reach for a modal first. Inline progressive disclosure (task detail panel, quick-add inline) is the default; modals are for search, shortcuts, and confirmations only.
- **Don't** invent custom form controls "for flavor" beyond the sanctioned set (Button, Input, Select, Checkbox, Radio, Toggle, Chip, Status Pill). The system already departs from category convention through type and surface; controls should be quiet.
- **Don't** add bounce, elastic, or spring motion. Transitions are 120–200ms, ease-out, no overshoot.
- **Don't** swap the dotted-paper body background for a flat fill. The grid is the page; without it, the metaphor breaks.
