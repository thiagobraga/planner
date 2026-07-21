interface HabitBlockPreviewProps {
  /** The dragged habit or group name. */
  name: string;
  /** Sub-habits carried along, or habits carried by a dragged group. */
  count: number;
  kind: 'habit' | 'habit-group';
}

/**
 * The dragged habit or group, drawn as its own row, for the drag overlay.
 *
 * The same reasoning as `TaskBlockPreview`: the real row registers sortable
 * hooks and owns edit state, none of which belong to a copy floating under the
 * pointer, so this repeats the row's type styles without its behaviour. What
 * travels then reads as the habit itself rather than a label describing it.
 *
 * Only the dragged row is drawn, not its sub-habits - the timeline never moves
 * rows during a drag (its two columns would fall out of step), so a full block
 * here would claim a rearrangement the list is not showing.
 */
export function HabitBlockPreview({ name, count, kind }: HabitBlockPreviewProps) {
  return (
    <div className="habit-block-preview flex h-6 min-w-0 items-center gap-1 pr-2" aria-hidden>
      {kind === 'habit' ? (
        <>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <span
              className="habit-timeline-row-color-dot h-2 w-2 rounded-full"
              style={{ background: 'var(--color-ink-lighter)' }}
            />
          </span>
          <span className="min-w-0 truncate text-sm leading-6 text-ink">{name}</span>
        </>
      ) : (
        <span className="min-w-0 truncate text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light">
          {name}
        </span>
      )}
      {count > 0 && <span className="shrink-0 text-[11px] text-ink-light">+{count}</span>}
    </div>
  );
}
