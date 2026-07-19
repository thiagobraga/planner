---
name: design-audit
description: Use when auditing React components or pages for design system violations. Triggers: "audit design", "check design tokens", "design review", checking visual/CSS correctness against Planner's design rules.
---

# Design Audit

## Overview

Planner's design system: Lora serif, cream/beige backgrounds, single brick-red accent (≤10%), flat elevation (no shadows), 24px vertical rhythm. DESIGN.md is the authoritative spec.

## Grep Commands

Run against a file or directory:

```bash
# No box-shadow (except overlay-drop on modals)
grep -rn "box-shadow" app/src/

# No sans-serif fonts
grep -rn "sans-serif\|system-ui\|Inter\|-apple-system\|Helvetica\|Arial" app/src/

# No raw #fff / #000 - use CSS vars
grep -rn "#fff\b\|#000\b\|#ffffff\|#000000" app/src/

# Check font-family usage (must be Lora/serif only)
grep -rn "font-family" app/src/

# Check accent usage - flag if used as bg or more than ~10% of visible surface
grep -rn "#c0392b\|#e74c3c\|var(--color-accent)" app/src/

# UPPERCASE / letter-spacing only on Label elements (11px/500/0.1em dividers)
grep -rn "text-transform.*uppercase\|letterSpacing\|letter-spacing" app/src/

# Side borders must be ≤1px
grep -rn "border-left\|border-right\|borderLeft\|borderRight" app/src/

# Blue only for P3 priority bullets (#3498db)
grep -rn "#3498db\|color.*blue\|background.*blue" app/src/
```

## CSS Variable Reference

| Token               | Hex             | Use                       |
| ------------------- | --------------- | ------------------------- |
| `--color-paper`     | `#f5f0e8`       | body background           |
| `--color-sidebar`   | `#ebe6de`       | secondary surface         |
| `--color-ink`       | `#2c2c2c`       | primary text              |
| `--color-ink-light` | `#6b6b6b`       | secondary text, captions  |
| `--color-accent`    | `#c0392b`       | brick-red, ≤10% of screen |
| `--color-border`    | `#d4cfc7`       | borders, dividers, chips  |
| `--font-serif`      | `"Lora", serif` | all text                  |

## Typography Scale

| Style    | Size | Weight | Line-height | Notes                                             |
| -------- | ---- | ------ | ----------- | ------------------------------------------------- |
| Numeric  | 56px | 600    | 56px        | Hero metrics only                                 |
| Display  | 18px | 600    | 24px        | Page titles                                       |
| Headline | 16px | 600    | 24px        | Section titles                                    |
| Body     | 14px | 400    | 24px        | Default                                           |
| Caption  | 12px | 400    | 24px        | Italic, labels                                    |
| Label    | 11px | 500    | 24px        | UPPERCASE, `letter-spacing: 0.1em`, dividers only |

## Allowed Shadow

Only one shadow exists in the system - overlay drop for modals/floating panels:

```css
box-shadow: 0 8px 32px rgba(44, 44, 44, 0.15);
```

Everything else: flat. Use `1px solid var(--color-border)` for elevation.

## Report Format

```
path/to/file.tsx:42: VIOLATION: box-shadow on card. Use 1px solid var(--color-border) instead.
path/to/file.tsx:67: VIOLATION: font-family "Inter". Use "Lora", serif or var(--font-serif).
path/to/file.tsx:91: VIOLATION: #fff background. Use var(--color-paper) or var(--color-sidebar).
```

## Don'ts Quick Reference

- No `#fff` / `#000` - always use ink/paper vars
- No sans-serif of any kind
- No `box-shadow` outside overlay-drop
- No orange (`#e67e22`) or blue (`#3498db`) outside P2/P3 priority bullets
- No `background-clip: text` gradients
- No elastic/spring/bounce animations - max 200ms ease-out
- No opaque card fills that hide the dot grid
- No brick-red (`--color-accent`) as decorative trim or on hover states
