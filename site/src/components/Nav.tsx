import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { REGISTER_URL } from "../config";

export function Nav() {
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
