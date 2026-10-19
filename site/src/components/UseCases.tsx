import { R, Label } from "./Reveal";

export function UseCases() {
  const cases = [
    ["Daily planning", "Bring tasks, events and notes into a daily view. Switch to the month when you need a wider perspective.", "A page for your day", "01"],
    ["Habit tracking", "Give your routines a place in the week. Track completions and see how your habits build over time.", "Room for small steps", "02"],
    ["Connect AI agents", "Use MCP to connect an AI assistant with Planner. Create and organize tasks through supported agent tools.", "Your tools, connected", "03"],
  ];
  return (
    <section className="dots py-28">
      <div className="mx-auto max-w-6xl px-5">
        <R className="text-center"><Label>Made for your days</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">A journal for the way you work</h2></R>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cases.map(([title, description, subtitle, number], i) => (
            <R key={title} d={i * 120}>
              <article className="glass h-full rounded-2xl border border-line p-7 transition hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(68,68,61,.12)]">
                <div className="text-accent" aria-hidden="true">{number} / Planner</div>
                <p className="mt-4 leading-7 italic">{description}</p>
                <div className="mt-6 flex items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-side font-semibold">{number}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs text-inkl">{subtitle}</p></div></div>
              </article>
            </R>
          ))}
        </div>
      </div>
    </section>
  );
}
