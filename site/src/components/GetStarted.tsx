import { R, Label } from "./Reveal";
import { REGISTER_URL, GITHUB_URL } from "../config";

export function GetStarted() {
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
