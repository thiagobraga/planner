# Monthly Page Nav Redesign — Design + Implementation Plan

**Status:** Approved by user, not yet implemented. Handed off between agent sessions (user ran out of credits mid-session) — this doc is written to be executable directly by a fresh agent with no prior context.

## Context

Planner's Monthly page (`app/src/pages/MonthlyPage.tsx` → `app/src/components/MonthlyRows.tsx`) currently has a year-chips row (2025/2026) plus a wrapping 12-month-chips selector, and a plain day-list below. The user supplied a target mockup (`/home/thiago/Downloads/planner-monthly-ui.png`, referenced earlier in conversation, not re-attached here) showing:
- A horizontal month-strip: `‹` arrow, 7 month tiles, `›` arrow — selected tile bordered/boxed, others muted
- Each tile shows a 2-digit number above a 3-letter month abbrev (e.g. `26` / `JUL`)
- Day rows with single-letter weekday labels (`F`, `S`, `S`, `M`...) instead of 3-letter
- Weekend rows (Sat+Sun) shaded with a continuous tan/cream background block

This work is **phase 2** of the Monthly feature. Phase 1 (already shipped, on `main`) added a `type` (task/note) column to `tasks`, task↔note conversion via `-`/`[`/`]`/`*` keystrokes on Daily, a `GET /views/month` endpoint, and wired `MonthlyRows.tsx` to fetch and render notes per day (the "writing area" slot next to each day's weekday label). **Do not touch that notes-fetching logic** — this phase is purely a visual/nav restyle of the same component.

Two design questions were asked and answered by the user before this doc was written:
1. **Strip number** = 2-digit year (e.g. `26` for 2026). The mockup's `25`s before July were stray/mock data in the screenshot, not a real mid-strip year rollover — always show the tile's actual year.
2. **Strip behavior** = sliding window: selected month always centered, 3 tiles before + 3 after. Arrows shift the window by 1 month at a time (not paging by year, not a fixed 12-month grid).

No backend or database changes in this phase. Single file touched: `app/src/components/MonthlyRows.tsx`.

## Current file state (for reference — read it fresh before editing, it may have moved)

As of this doc, `app/src/components/MonthlyRows.tsx` is 111 lines:
- Lines 4-9: `YEARS`, `MONTHS`, `DAYS_OF_WEEK` (3-letter), layout width constants
- Lines 15-30: component state (`selectedYear`, `selectedMonth`, `notesByDate`) + the `fetchMonthNotes` effect (KEEP AS-IS)
- Lines 32-46: `daysInMonth`/`days` computation (KEEP AS-IS, weekday letter change happens at render, not here — see below)
- Lines 50-61: year-chips row (**DELETE**, replaced by month strip)
- Lines 63-74: month-chips row (**DELETE**, replaced by month strip)
- Lines 76-107: day list (**MODIFY**: weekday label + weekend shading only; notes rendering at lines 96-103 stays untouched)

## Implementation

### 1. Month strip — replaces lines 50-74

Add a helper to compute the 7-tile sliding window and month navigation, plus single-letter weekday array:

```tsx
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index matches Date#getDay() (0=Sun)

function monthTiles(year: number, month: number): { year: number; month: number }[] {
  const tiles = [];
  for (let offset = -3; offset <= 3; offset++) {
    const total = year * 12 + month + offset;
    tiles.push({ year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
  }
  return tiles;
}

function shiftMonth(year: number, month: number, dir: 1 | -1): { year: number; month: number } {
  const total = year * 12 + month + dir;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
```

Place these above the `MonthlyRows` component (replacing the old `YEARS`/`MONTHS` constants — `DAYS_OF_WEEK` stays, it's still used for the `dayOfWeek` field in `days`, or optionally replace its usage too, see step 2).

JSX replacing lines 50-74 (year-chips + month-chips):

```tsx
{/* Month Strip */}
<div className="flex items-center gap-2 h-12">
  <button
    type="button"
    onClick={() => {
      const next = shiftMonth(selectedYear, selectedMonth, -1);
      setSelectedYear(next.year);
      setSelectedMonth(next.month);
    }}
    className="w-6 h-6 flex items-center justify-center text-ink-light hover:text-ink shrink-0"
    aria-label="Previous month"
  >
    ‹
  </button>

  <div className="flex flex-1 gap-1">
    {monthTiles(selectedYear, selectedMonth).map((tile) => {
      const isSelected = tile.year === selectedYear && tile.month === selectedMonth;
      return (
        <button
          key={`${tile.year}-${tile.month}`}
          type="button"
          onClick={() => {
            setSelectedYear(tile.year);
            setSelectedMonth(tile.month);
          }}
          className={`flex-1 flex flex-col items-center justify-center h-12 leading-tight text-[11px] tracking-[-0.01em] uppercase ${
            isSelected
              ? 'border border-dot rounded font-semibold text-ink'
              : 'font-medium text-ink-light opacity-60'
          }`}
        >
          <span className="tabular-nums">{String(tile.year).slice(-2)}</span>
          <span>{MONTHS_SHORT[tile.month]}</span>
        </button>
      );
    })}
  </div>

  <button
    type="button"
    onClick={() => {
      const next = shiftMonth(selectedYear, selectedMonth, 1);
      setSelectedYear(next.year);
      setSelectedMonth(next.month);
    }}
    className="w-6 h-6 flex items-center justify-center text-ink-light hover:text-ink shrink-0"
    aria-label="Next month"
  >
    ›
  </button>
</div>
```

Note: `selectedMonth` stays 0-indexed throughout (matches existing `useState(4)` for May convention) — `monthTiles`/`shiftMonth` both operate in 0-indexed month space consistently with the rest of the file (`fetchMonthNotes(selectedYear, selectedMonth + 1)` already converts to 1-indexed only at the API-call boundary, unchanged).

### 2. Weekday letters + weekend shading — modify lines 76-107

Replace the 3-letter `dayOfWeek` display and add weekend background shading. Two sub-changes:

**a) Weekday label** — at render time (not in the `days` computation), swap `d.dayOfWeek` (3-letter) for `WEEKDAY_LETTERS[...]`. Simplest: keep `days` computation as-is (still has `dayOfWeekIndex` implicitly via `DAYS_OF_WEEK[dayOfWeekIndex]`), but change line 95 from:
```tsx
<span className="w-10">{d.dayOfWeek}</span>
```
to derive the letter from the existing `dayOfWeek` 3-letter string's first character (no need to add a new field):
```tsx
<span className="w-6">{d.dayOfWeek[0]}</span>
```
(width can shrink from `w-10` to `w-6` since it's now one character — adjust `WEEKDAY_LABEL_WIDTH` constant at line 8 from `40` to `24` to match, and `WRITING_AREA_START` recomputes automatically since it's derived).

**b) Weekend shading** — replace the old week-divider line (lines 80-88, the `startsWeekRule`/`firstSunday` top-border logic) with a background tint spanning each weekend row. Simplest implementation: drop the `startsWeekRule`/`firstSunday` divider entirely (the mockup doesn't show week-divider lines, just weekend shading) and add a conditional background class directly on each day row's outer `<div>` (currently line 79, `<div key={d.day}>`):

```tsx
{days.map((d) => (
  <div key={d.day} className={d.isWeekend ? 'bg-dot/20' : ''}>
    <div className="flex h-6 leading-6 text-[11px] tracking-[-0.01em] uppercase text-ink-light font-normal">
      <span className="w-6 tabular-nums">{d.day.toString().padStart(2, '0')}</span>
      <span className="w-6">{d.dayOfWeek[0]}</span>
      <div className="flex items-center h-6 flex-1 min-w-0">
        <div className="w-3 h-6 border-l border-dot opacity-80 shrink-0" />
        {notesByDate[dateKey(selectedYear, selectedMonth, d.day)]?.length ? (
          <span className="text-[11px] leading-6 text-ink truncate ml-1 normal-case tracking-normal">
            {notesByDate[dateKey(selectedYear, selectedMonth, d.day)].join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  </div>
))}
```

This removes the now-unused `firstSunday` computation (lines 33-35) and `startsWeekRule` field (line 44) from the `days` array builder — delete both, they're no longer referenced anywhere.

`bg-dot/20` uses Tailwind's opacity-modifier syntax against the existing `--color-dot` token (`#d4cfc7`, already used elsewhere for borders/divider dots) — reuses an existing design-system color rather than inventing a new one, consistent with DESIGN.md's "single accent color, minimal palette" rule. If `bg-dot/20` doesn't render correctly (verify — this project uses Tailwind v4 CSS-variable-based theme, confirm `dot` is registered as a Tailwind color name, not just a raw CSS var; check `app/src/index.css` around line 4-14 and `app/tailwind.config.js` for how `--color-dot` is exposed to Tailwind's `bg-*`/`border-*` utilities, since existing code already uses `border-dot` successfully at line 85/97 so `bg-dot` should work the same way).

### 3. Cleanup

- Delete unused `YEARS` and `MONTHS` constants (replaced by `MONTHS_SHORT`, used only in the strip).
- `DAYS_OF_WEEK` (3-letter array) can stay as-is since `d.dayOfWeek[0]` derives the letter from it — no need for a separate `WEEKDAY_LETTERS` array unless preferred for clarity (either approach works; the `WEEKDAY_LETTERS` array shown in step 1 is optional/unused if you go with the `.dayOfWeek[0]` derivation in step 2a — pick ONE approach, don't leave both).

## Verification

1. `cd app && npx tsc --noEmit` — must pass clean (if `@rollup/rollup-linux-x64-gnu` module errors appear when running `npx vitest`, run `npm install --no-save @rollup/rollup-linux-x64-gnu` first — known environment quirk in this sandbox, unrelated to the code).
2. Manual: open `https://planner.local/monthly` (or via `docker restart planner-app` / `docker compose up -d app` if the container isn't running — check `docker ps` first), confirm:
   - Strip shows 7 tiles centered on current month, arrows shift by 1 month, clicking a tile jumps directly to it, year rolls over correctly at Dec→Jan and Jan→Dec boundaries (e.g. navigate to Dec 2026, click `›` three times, confirm Jan/Feb/Mar 2027 tiles appear correctly)
   - Weekday column shows single letters
   - Sat+Sun rows have a visible tan/tint background, weekdays don't
   - Notes still render correctly in the writing-area slot (regression check on phase-1 work — don't break it)
3. No backend changes in this phase — no API/DB verification needed.

## Explicitly out of scope for this phase

- Any change to `fetchMonthNotes`/notes rendering logic (phase 1, already working, don't touch)
- Task display on Monthly (user already decided: notes-only, phase 1 decision, unchanged)
- Any change to `MonthlyPage.tsx` (the page wrapper) — only `MonthlyRows.tsx` changes
