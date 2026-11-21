import type { LucideProps } from 'lucide-react';

export function DotsConnectedIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size ?? 24}
      height={props.size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}
