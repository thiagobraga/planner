import { useEffect, useRef, useState } from "react";
import { Laptop, Tablet, Phone, Logo } from "./components/Mockups";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { APP_URL, REGISTER_URL, GITHUB_URL } from "./config";
import type { RevealProps, ChildrenProps } from "./types/ui";

function useReveal() {
  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add("reveal-ready");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

const R = ({ children, d = 0, className = "" }: RevealProps) => (
  <div className={`reveal ${className}`} style={{ transitionDelay: `${d}ms` }}>{children}</div>
);

const Label = ({ children }: ChildrenProps) => (
  <p className="mb-4 text-xs font-medium tracking-[0.18em] text-accent uppercase">{children}</p>
);



function Nav() {
  const [s, setS] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => {
    const f = () => setS(window.scrollY > 20);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const links = ["Features", "Showcase", "Get started", "FAQ"];
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${s ? "glass border-b border-line/80 shadow-[0_1px_2px_rgba(68,68,61,.06)]" : ""}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
        <a href="#top" className="flex items-center gap-2 text-lg font-semibold"><Logo className="h-7 w-7" /> Planner</a>
        <div className="hidden items-center gap-5 text-sm md:flex">
          {links.map((l) => <a key={l} href={`#${l.toLowerCase().replaceAll(" ", "-")}`} className="text-inkl transition hover:text-ink">{l}</a>)}
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <ThemeSwitcher label="Desktop theme" />
          <a href={REGISTER_URL} className="rounded-lg bg-ink px-4 py-2 text-sm text-paper transition hover:-translate-y-0.5 hover:shadow-lg inline-block">Get started</a>
        </div>
        <button ref={menuButton} type="button" className="md:hidden p-2" aria-controls="mobile-navigation" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div className="space-y-1.5"><span className={`block h-0.5 w-5 bg-ink transition ${open ? "translate-y-2 rotate-45" : ""}`} /><span className={`block h-0.5 w-5 bg-ink transition ${open ? "opacity-0" : ""}`} /><span className={`block h-0.5 w-5 bg-ink transition ${open ? "-translate-y-2 -rotate-45" : ""}`} /></div>
        </button>
      </nav>
      {open && (
        <div id="mobile-navigation" className="glass border-b border-line px-5 pb-5 md:hidden">
          <div className="py-3"><ThemeSwitcher label="Mobile theme" /></div>
          {links.map((l) => <a key={l} onClick={() => setOpen(false)} href={`#${l.toLowerCase().replaceAll(" ", "-")}`} className="block border-b border-line py-3">{l}</a>)}
          <a href={REGISTER_URL} onClick={() => setOpen(false)} className="mt-4 block rounded-lg bg-ink py-3 text-center text-paper">Get started</a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="dots relative overflow-hidden pt-32 pb-20 sm:pt-40">
      <div className="blob absolute -top-20 -left-20 h-96 w-96 rounded-full bg-accentl/20 blur-3xl" />
      <div className="blob absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-moss/20 blur-3xl" style={{ animationDelay: "-6s" }} />
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
          <R d={500} className="mx-auto w-[88%] sm:w-[78%]"><Laptop interactive /></R>
          <div className="floaty absolute -bottom-6 -left-2 w-[24%] sm:left-0"><R d={700}><Tablet /></R></div>
          <div className="floaty-d absolute -right-1 -bottom-10 w-[15%] sm:right-2"><R d={800}><Phone /></R></div>
        </div>
        <p className="mt-16 text-xs text-inkl italic">Tip: click a task on the laptop to mark it done ✕</p>
      </div>
    </section>
  );
}

function Proof() {
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

const features = [
  { i: "•", t: "Rapid logging", d: "Capture tasks, events and notes with familiar Bullet Journal signifiers. Keep your thoughts in one place." },
  { i: "◫", t: "Daily & monthly views", d: "Zoom from today's page to the whole month. Organize your tasks in list, kanban, cards or monthly views." },
  { i: "▦", t: "Habit tracking", d: "A gentle grid of moss-green squares that rewards consistency, not perfection." },
  { i: "❖", t: "Collections & tags", d: "Organize reading lists, projects and ideas in collections. Add labels and saved filters to find what matters." },
  { i: "⌘", t: "Connect your tools", d: "Connect AI agents through MCP, or use personal API tokens to work with your tasks from other tools." },
  { i: "⇄", t: "Real-time sync", d: "Stay up to date across connected tabs and devices. Changes appear as you plan." },
];

function Features() {
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

function Showcase() {
  const tabs = [
    { n: "Desk", c: <img src="/desk.jpg" alt="Planner running on a laptop, tablet and phone on a wooden desk" className="aspect-[16/10] w-full rounded-2xl object-cover" loading="lazy" /> },
    { n: "Desktop", c: <div className="px-4 py-8 sm:px-16"><Laptop interactive /></div> },
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

function Benefits() {
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

function UseCases() {
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

function GetStarted() {
  const options = [
    { name: "Self-host", subtitle: "Run your own Planner", mark: "Host", features: ["MIT-licensed source", "Docker configuration", "PostgreSQL + Redis", "Setup guide in the repository"], cta: "View self-hosting guide", href: GITHUB_URL },
    { name: "Hosted app", subtitle: "A place to start planning", mark: "Plan", features: ["Daily & monthly views", "Habit tracking", "Collections, labels & filters", "Real-time sync"], cta: "Create your account", href: REGISTER_URL, featured: true },
    { name: "Contribute", subtitle: "Help shape the next page", mark: "Build", features: ["Explore the source", "Report an issue", "Suggest improvements", "Contribute on GitHub"], cta: "Explore on GitHub", href: GITHUB_URL },
  ];
  return (
    <section id="get-started" className="bg-side/60 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <R className="text-center"><Label>Get started</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your next page starts here</h2></R>
        <R d={100} className="mt-8 text-center text-sm text-inkl">Open the app, host it yourself, or help build what comes next.</R>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {options.map((option, i) => (
            <R key={option.name} d={i * 100}>
              <div className={`relative flex h-full flex-col rounded-2xl border p-8 transition hover:-translate-y-1 ${option.featured ? "border-ink bg-ink text-paper shadow-[0_30px_60px_-20px_rgba(44,44,40,.6)]" : "border-line bg-paper"}`}>
                {option.featured && <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs text-on-accent">Start here</span>}
                <h3 className="text-xl font-semibold">{option.name}</h3>
                <p className={`text-sm ${option.featured ? "text-paper/70" : "text-inkl"}`}>{option.subtitle}</p>
                <div className="mt-6 text-5xl font-semibold tracking-tight">{option.mark}</div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">{option.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className={option.featured ? "text-accentl" : "text-moss"}>✓</span>{feature}</li>)}</ul>
                <a href={option.href} className={`mt-8 rounded-xl py-3 text-center transition hover:-translate-y-0.5 ${option.featured ? "bg-paper text-ink" : "border border-ink hover:bg-ink hover:text-paper"}`}>{option.cta}</a>
              </div>
            </R>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const q = [
    ["Do I need to know the Bullet Journal method?", "No. Start with a task, event or note, then organize your day at your own pace. The paper-inspired interface keeps your plans in view."],
    ["What can I organize with Planner?", "Plan tasks, events and notes in daily and monthly views. Organize collections, add labels, save filters and track habits."],
    ["Which devices are supported?", "Use Planner in a browser on your desktop, tablet or phone. Connected sessions receive updates through real-time sync."],
    ["Can I self-host?", "Yes. Planner is MIT-licensed and includes Docker configuration for the app, API, PostgreSQL and Redis. The GitHub repository has setup instructions."],
    ["Can I connect an AI assistant?", "Yes. Planner exposes MCP tools for supported AI clients and personal API tokens for scripts. Manage your connections in the app's integration settings."],
  ];
  const [o, setO] = useState<number | null>(0);
  return (
    <section id="faq" className="py-28">
      <div className="mx-auto max-w-3xl px-5">
        <R className="text-center"><Label>FAQ</Label><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Questions, answered</h2></R>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {q.map(([a, b], i) => (
            <R key={a} d={i * 60}>
              <button type="button" id={`faq-question-${i}`} aria-controls={`faq-answer-${i}`} aria-expanded={o === i} onClick={() => setO(o === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold">
                {a}<span className={`text-xl transition duration-300 ${o === i ? "rotate-45 text-accent" : ""}`}>+</span>
              </button>
              <div id={`faq-answer-${i}`} role="region" aria-labelledby={`faq-question-${i}`} hidden={o !== i} className="pb-5"><p className="overflow-hidden text-sm leading-7 text-inkl">{b}</p></div>
            </R>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
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

function Footer() {
  return (
    <footer className="border-t border-line py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 text-sm text-inkl md:flex-row">
        <div className="flex items-center gap-2 text-ink"><Logo className="h-6 w-6" /><span className="font-semibold">Planner</span><span className="text-inkl">- Bullet Journal, beautifully.</span></div>
        <div className="flex gap-6"><a href="#features" className="hover:text-ink">Features</a><a href="#get-started" className="hover:text-ink">Get started</a><a href={GITHUB_URL} className="hover:text-ink">GitHub</a><a href="#faq" className="hover:text-ink">FAQ</a></div>
        <p>© {new Date().getFullYear()} Planner · MIT License</p>
      </div>
    </footer>
  );
}

export default function App() {
  useReveal();
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <Nav />
      <main id="main-content" tabIndex={-1}><Hero /><Proof /><Features /><Showcase /><Benefits /><UseCases /><GetStarted /><FAQ /><CTA /></main>
      <Footer />
    </>
  );
}

