import type { RevealProps, ChildrenProps } from "../types/ui";

export const R = ({ children, d = 0, className = "" }: RevealProps) => (
  <div className={`reveal ${className}`} style={{ transitionDelay: `${d}ms` }}>{children}</div>
);

export const Label = ({ children }: ChildrenProps) => (
  <p className="mb-4 text-xs font-medium tracking-[0.18em] text-accent uppercase">{children}</p>
);
