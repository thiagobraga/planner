import type { LogoProps } from "../types/ui";

export function Logo({ className = "" }: LogoProps) {
  return <img src="/logo-64x64.png" srcSet="/logo-128x128.png 2x" alt="" aria-hidden="true" className={className} />;
}
