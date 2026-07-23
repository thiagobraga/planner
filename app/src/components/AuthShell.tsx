import type { ReactNode } from 'react';
import { Link } from 'react-router';

const PlannerIcon64 = () => (
  <img
    src="/images/bulletjournal-planner-64x64.png"
    width={64}
    height={64}
    alt=""
    className="block mx-auto"
  />
);

export interface AuthShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

// Shared frame for the four logged-out screens: login, register, forgot
// password, reset password.
export function AuthShell({ children, title = 'Planner', subtitle = 'Bulletjournal online' }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-6">
      <div className="w-full max-w-80">
        <div className="text-center mb-6">
          <PlannerIcon64 />
          <h1 className="text-lg leading-6 font-semibold text-ink mt-2">{title}</h1>
          <p className="text-[13px] leading-6 text-ink-light opacity-60">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-[13px] leading-6 text-ink-light hover:text-ink underline underline-offset-2 transition-colors duration-[var(--motion-fast)]"
    >
      {children}
    </Link>
  );
}

export function AuthFormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[13px] leading-6 text-accent">
      {children}
    </p>
  );
}
