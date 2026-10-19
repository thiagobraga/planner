import { useState } from "react";
import { R, Label } from "./Reveal";

export function FAQ() {
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
