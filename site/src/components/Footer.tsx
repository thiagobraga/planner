import { Logo } from "./Logo";
import { GITHUB_URL } from "../config";

export function Footer() {
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
