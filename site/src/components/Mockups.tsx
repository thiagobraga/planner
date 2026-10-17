import { useState } from "react";

import type { DemoTask, BulletProps, DailyListProps, LogoProps, LaptopProps, HabitsProps } from "../types/ui";
const initial: DemoTask[] = [
  { t: "Review quarterly goals", k: "task", p: 1 },
  { t: "Coffee with Marta, 10:00", k: "event" },
  { t: "Draft chapter three", k: "task", p: 2, done: true },
  { t: "Ideas feel lighter on paper", k: "note" },
  { t: "Book train tickets", k: "task", p: 3 },
  { t: "Evening run - 5 km", k: "task", done: true },
];
const pc = { 1: "bg-accent", 2: "bg-p2", 3: "bg-p3" } as const;

function Bullet({ k, done }: BulletProps) {
  if (k === "event") return <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink" />;
  if (k === "note") return <span className="h-[1.5px] w-2.5 bg-ink" />;
  return done ? <span className="text-xs leading-none text-accent">✕</span> : <span className="h-1.5 w-1.5 rounded-full bg-ink" />;
}

export function DailyList({ compact = false, interactive = false }: DailyListProps) {
  const [tasks, setTasks] = useState(initial);
  const list = compact ? tasks.slice(0, 5) : tasks;
  return (
    <ul className="space-y-0">
      {list.map((task, i) => {
        const canToggle = interactive && task.k === "task";
        const rowClass = `group flex w-full items-center gap-3 border-b border-line/70 text-left ${compact ? "py-1.5 text-[11px]" : "py-2 text-sm"} ${canToggle ? "cursor-pointer hover:bg-side/60" : ""}`;
        const content = <>
          <span aria-hidden="true" className="flex w-3 shrink-0 justify-center"><Bullet k={task.k} done={task.done} /></span>
          <span className={`min-w-0 flex-1 truncate transition ${task.done ? "text-inkl line-through" : ""} ${task.k === "note" ? "italic text-inkl" : ""}`}>{task.t}</span>
          {task.p && <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${pc[task.p]}`} />}
        </>;
        return (
          <li key={task.t}>
            {canToggle ? (
              <button
                type="button"
                aria-pressed={Boolean(task.done)}
                aria-label={task.t}
                onClick={() => setTasks((current) => current.map((item, j) => j === i ? { ...item, done: !item.done } : item))}
                className={rowClass}
              >{content}</button>
            ) : <div className={rowClass}>{content}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function Habits({ small }: HabitsProps) {
  const rows = ["Read", "Meditate", "Water", "Walk"];
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={r} className="flex items-center gap-2">
          <span className={`${small ? "w-12 text-[9px]" : "w-16 text-[11px]"} text-inkl`}>{r}</span>
          <div className="flex gap-1">
            {Array.from({ length: small ? 7 : 14 }).map((_, d) => (
              <span key={d} className={`${small ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} rounded-[3px] ${(d * 7 + i * 3) % 5 < 3 ? "bg-moss" : "bg-side"}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-40 shrink-0 border-r border-line bg-side p-4 text-[11px] sm:block">
      <div className="mb-5 flex items-center gap-2 font-semibold"><Logo className="h-5 w-5" /> Planner</div>
      {["Daily", "Monthly", "Habits", "Collections"].map((n, i) => (
        <div key={n} className={`mb-1 rounded-md px-2 py-1 ${i === 0 ? "bg-paper font-medium shadow-sm" : "text-inkl"}`}>{n}</div>
      ))}
      <div className="mt-5 mb-1 text-[9px] tracking-[0.1em] text-inkl uppercase">Tags</div>
      {[["work", "bg-accent"], ["home", "bg-p3"], ["health", "bg-moss"]].map(([t, c]) => (
        <div key={t} className="flex items-center gap-2 px-2 py-0.5 text-inkl"><span className={`h-1.5 w-1.5 rounded-full ${c}`} />{t}</div>
      ))}
    </aside>
  );
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="7" fill="var(--color-ink)" />
      <circle cx="11" cy="12" r="1.8" fill="var(--planner-page-bg)" />
      <rect x="15" y="11" width="9" height="2" rx="1" fill="var(--planner-page-bg)" />
      <circle cx="11" cy="20" r="1.8" fill="var(--color-accent)" />
      <rect x="15" y="19" width="6" height="2" rx="1" fill="var(--planner-page-bg)" />
    </svg>
  );
}

export function Laptop({ interactive = false }: LaptopProps) {
  return (
    <div className="mx-auto w-full" aria-label="Planner daily planning demo">
      <div className="rounded-t-2xl border border-[#2c2c28] bg-[#2c2c28] p-2 shadow-[0_30px_80px_-20px_rgba(44,44,40,.45)] sm:p-3">
        <div className="flex aspect-[16/10] overflow-hidden rounded-md bg-paper">
          <Sidebar />
          <div className="dots min-w-0 flex-1 overflow-hidden p-4 sm:p-6">
            <div className="mb-1 text-[10px] tracking-[0.1em] text-inkl uppercase">Tuesday</div>
            <div className="mb-4 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight sm:text-5xl">14</span>
              <span className="pb-1 text-sm text-inkl italic">October</span>
            </div>
            <DailyList interactive={interactive} />
          </div>
          <div className="hidden w-44 shrink-0 border-l border-line p-4 lg:block">
            <div className="mb-2 text-[9px] tracking-[0.1em] text-inkl uppercase">This week</div>
            <Habits small />
          </div>
        </div>
      </div>
      <div className="relative mx-[-4%] h-3 rounded-b-xl bg-gradient-to-b from-[#d9d4cb] to-[#b8b2a8] sm:h-4">
        <div className="absolute top-0 left-1/2 h-1.5 w-1/6 -translate-x-1/2 rounded-b-md bg-[#a8a298]" />
      </div>
    </div>
  );
}

export function Tablet() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  return (
    <div className="rounded-[1.6rem] bg-[#2c2c28] p-2.5 shadow-[0_30px_60px_-20px_rgba(44,44,40,.5)]">
      <div className="aspect-[3/4] overflow-hidden rounded-[1.1rem] bg-paper p-4">
        <div className="mb-1 text-[9px] tracking-[0.1em] text-inkl uppercase">Monthly</div>
        <div className="mb-3 text-xl font-semibold">October</div>
        <div className="grid grid-cols-7 gap-1 text-[9px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="text-center text-inkl">{d}</div>)}
          {days.map((d) => (
            <div key={d} className={`flex aspect-square flex-col items-center justify-center rounded-md ${d === 14 ? "bg-ink text-paper" : d > 0 && d <= 31 ? "bg-side/60" : "opacity-0"}`}>
              {d > 0 && d <= 31 ? d : ""}
              {[3, 9, 14, 21, 27].includes(d) && <span className={`mt-0.5 h-1 w-1 rounded-full ${d === 14 ? "bg-paper" : "bg-accent"}`} />}
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-[9px] tracking-[0.1em] text-inkl uppercase">Habits</div>
          <Habits small />
        </div>
      </div>
    </div>
  );
}

export function Phone() {
  return (
    <div className="rounded-[2.2rem] bg-[#2c2c28] p-2 shadow-[0_30px_60px_-15px_rgba(44,44,40,.55)]">
      <div className="relative aspect-[9/19] overflow-hidden rounded-[1.7rem] bg-paper">
        <div className="absolute top-2 left-1/2 h-4 w-16 -translate-x-1/2 rounded-full bg-[#2c2c28]" />
        <div className="dots h-full px-3.5 pt-9">
          <div className="text-[8px] tracking-[0.1em] text-inkl uppercase">Today</div>
          <div className="mb-2 flex items-end gap-1.5"><span className="text-2xl font-semibold">14</span><span className="pb-0.5 text-[10px] text-inkl italic">Oct</span></div>
          <DailyList compact />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper/80 px-2 py-0.5 text-[8px] text-inkl backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" /> Synced
          </div>
        </div>
        <div aria-hidden="true" className="absolute right-3 bottom-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg text-paper shadow-lg">+</div>
      </div>
    </div>
  );
}

