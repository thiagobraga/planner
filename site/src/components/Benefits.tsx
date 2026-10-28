import { R, Label } from "./Reveal";

export function Benefits() {
  const b = [
    ["Think more clearly", "The paper-inspired canvas lowers visual noise, so you see priorities instead of interfaces."],
    ["Finish what matters", "Three priority colours and flexible daily views help keep important tasks in sight."],
    ["Build lasting habits", "Small daily check-ins compound. Watch the grid fill up and feel momentum build."],
    ["Make it your own", "Explore the MIT-licensed source, contribute improvements or run Planner on your own server."],
  ];
  return (
    <section className="py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-2">
        <R><div className="relative"><img src="/desk.jpg" alt="" className="rounded-3xl shadow-[0_30px_60px_-20px_rgba(44,44,40,.4)]" loading="lazy" />
          <div className="glass floaty absolute -right-3 -bottom-6 rounded-2xl border border-line p-4 shadow-lg sm:right-6"><div className="text-xs text-inkl">Daily habits</div><div className="text-3xl font-semibold">Small steps <span className="text-moss">↑</span></div></div></div></R>
        <div>
          <R><Label>Benefits</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Less managing.<br /><em className="text-accent">More living.</em></h2></R>
          <div className="mt-10 space-y-7">
            {b.map(([t, d], i) => (
              <R key={t} d={i * 100}><div className="flex gap-4"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs text-paper">{i + 1}</span><div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm leading-6 text-inkl">{d}</p></div></div></R>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
