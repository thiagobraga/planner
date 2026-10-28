import { R } from "./Reveal";

export function Proof() {
  const items = ["Writers", "Designers", "Students", "Founders", "Teachers", "Engineers", "Parents", "Researchers"];
  return (
    <section className="border-y border-line py-12" aria-label="Planner highlights">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 text-center md:grid-cols-4">
        {[["Daily", "Plan your days"], ["Habits", "Track your routines"], ["Live", "Real-time sync"], ["MIT", "Open source"]].map(([n, l], i) => (
          <R key={l} d={i * 100}><div className="text-4xl font-semibold tracking-tight">{n}</div><div className="mt-1 text-xs tracking-[0.1em] text-inkl uppercase">{l}</div></R>
        ))}
      </div>
      <div className="mt-10 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
        <div className="marquee flex w-max gap-12 text-xl text-inkl/70 italic">
          {[...items, ...items].map((x, i) => <span key={i}>For {x.toLowerCase()} ·</span>)}
        </div>
      </div>
    </section>
  );
}
