import { R } from "./Reveal";
import { APP_URL, REGISTER_URL } from "../config";

export function CTA() {
  return (
    <section id="cta" className="px-5 pb-28">
      <R className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-6 py-20 text-center text-paper">
        <div className="blob absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
        <div className="blob absolute -right-10 -bottom-24 h-72 w-72 rounded-full bg-moss/30 blur-3xl" style={{ animationDelay: "-5s" }} />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Turn the page on chaos.</h2>
          <p className="mx-auto mt-4 max-w-md text-paper/70">Give your tasks, habits and ideas a place to settle. Open Planner and start with today.</p>
          <div className="mx-auto mt-8 flex max-w-md flex-col justify-center gap-3 sm:flex-row">
            <a href={REGISTER_URL} className="rounded-xl bg-paper px-6 py-3.5 font-medium text-ink transition hover:-translate-y-0.5">Get started</a>
            <a href={APP_URL} className="rounded-xl border border-paper/40 px-6 py-3.5 text-paper transition hover:-translate-y-0.5">Open Planner</a>
          </div>
        </div>
      </R>
    </section>
  );
}
