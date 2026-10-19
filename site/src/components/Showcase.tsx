import { useRef, useState } from "react";
import { R, Label } from "./Reveal";
import { Laptop, Tablet, Phone } from "./Devices";

export function Showcase() {
  const tabs = [
    { n: "Desk", c: <img src="/desk.jpg" alt="Planner running on a laptop, tablet and phone on a wooden desk" className="aspect-[16/10] w-full rounded-2xl object-cover" loading="lazy" /> },
    { n: "Desktop", c: <div className="px-4 py-8 sm:px-16"><Laptop /></div> },
    { n: "Tablet", c: <div className="mx-auto w-[60%] max-w-sm py-8"><Tablet /></div> },
    { n: "Mobile", c: <div className="mx-auto w-[45%] max-w-[240px] py-8"><Phone /></div> },
  ];
  const [a, setA] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <section id="showcase" className="bg-side/60 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <R className="mx-auto max-w-2xl text-center"><Label>Showcase</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">One journal. Every screen.</h2><p className="mt-4 text-inkl">Plan in your browser on desktop, tablet and phone. Same paper-like calm, everywhere.</p></R>
        <R d={100} className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Planner preview" className="inline-flex rounded-xl border border-line bg-paper p-1">
            {tabs.map((t, i) => (
              <button key={t.n} ref={(node) => { tabRefs.current[i] = node; }} id={`showcase-tab-${i}`} type="button" role="tab" aria-controls={`showcase-panel-${i}`} tabIndex={a === i ? 0 : -1} aria-selected={a === i} onClick={() => setA(i)} onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
                else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = tabs.length - 1;
                else return;
                event.preventDefault(); setA(next); tabRefs.current[next]?.focus();
              }} className={`rounded-lg px-4 py-2 text-sm transition ${a === i ? "bg-ink text-paper shadow" : "text-inkl hover:text-ink"}`}>{t.n}</button>
            ))}
          </div>
        </R>
        <R d={200} className="mt-10">
          <div key={a} id={`showcase-panel-${a}`} role="tabpanel" tabIndex={0} aria-labelledby={`showcase-tab-${a}`} className="dots rounded-3xl border border-line bg-paper p-3 shadow-[0_8px_32px_rgba(44,44,44,.1)] animate-[floaty_0s] transition">{tabs[a].c}</div>
        </R>
      </div>
    </section>
  );
}
