import { R, Label } from "./Reveal";

const features = [
  { i: "•", t: "Rapid logging", d: "Capture tasks, events and notes with familiar Bullet Journal signifiers. Keep your thoughts in one place." },
  { i: "◫", t: "Daily & monthly views", d: "Zoom from today's page to the whole month. Organize your tasks in list, kanban, cards or monthly views." },
  { i: "▦", t: "Habit tracking", d: "A gentle grid of moss-green squares that rewards consistency, not perfection." },
  { i: "❖", t: "Collections & tags", d: "Organize reading lists, projects and ideas in collections. Add labels and saved filters to find what matters." },
  { i: "⌘", t: "Connect your tools", d: "Connect AI agents through MCP, or use personal API tokens to work with your tasks from other tools." },
  { i: "⇄", t: "Real-time sync", d: "Stay up to date across connected tabs and devices. Changes appear as you plan." },
];

export function Features() {
  return (
    <section id="features" className="py-28">
      <div className="mx-auto max-w-6xl px-5">
        <R className="mx-auto max-w-2xl text-center"><Label>Features</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Everything a journal needs. <em className="text-inkl">Nothing it doesn't.</em></h2></R>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <R key={f.t} d={i * 80}>
              <article className="group h-full rounded-2xl border border-line bg-paper p-7 shadow-[0_1px_2px_rgba(68,68,61,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(68,68,61,.12)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-side text-xl transition group-hover:bg-ink group-hover:text-paper">{f.i}</div>
                <h3 className="text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm leading-6 text-inkl">{f.d}</p>
              </article>
            </R>
          ))}
        </div>
      </div>
    </section>
  );
}
