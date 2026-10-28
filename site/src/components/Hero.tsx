import { R } from "./Reveal";
import { Laptop, Tablet, Phone } from "./Devices";
import { REGISTER_URL } from "../config";

export function Hero() {
  return (
    <section id="top" className="dots relative overflow-hidden pt-32 pb-20 sm:pt-40">
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
      <div className="relative mx-auto max-w-6xl px-5 text-center">
        <R><span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1 text-xs text-inkl backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss" /> Daily planning, habits & real-time sync</span></R>
        <R d={100}><h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tight sm:text-7xl">The calm of paper.<br /><em className="font-medium text-accent">The power of an app.</em></h1></R>
        <R d={200}><p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-inkl">Planner is a beautiful Bullet Journal for your days, months and habits. Capture thoughts, organize tasks, and keep everything in sync, without the noise.</p></R>
        <R d={300} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={REGISTER_URL} className="group rounded-xl bg-ink px-7 py-3.5 text-paper shadow-[0_10px_30px_-10px_rgba(68,68,61,.6)] transition hover:-translate-y-0.5">Start journaling <span className="inline-block transition group-hover:translate-x-1">→</span></a>
          <a href="#showcase" className="rounded-xl border border-line bg-paper/70 px-7 py-3.5 backdrop-blur transition hover:border-ink">See it in action</a>
        </R>
        <R d={400}><p className="mt-4 text-xs text-inkl">Daily planning · Habit tracking · Open source (MIT)</p></R>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <R d={500} className="mx-auto w-[88%] sm:w-[78%]"><Laptop /></R>
          <div className="floaty absolute -bottom-6 -left-2 w-[24%] sm:left-0"><R d={700}><Tablet /></R></div>
          <div className="floaty-d absolute -right-1 -bottom-10 w-[15%] sm:right-2"><R d={800}><Phone /></R></div>
        </div>
      </div>
    </section>
  );
}
