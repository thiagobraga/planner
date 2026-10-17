import type { DebugCardProps } from '../types/debug';

export function DebugCard({ id, orderValue, createdAt }: DebugCardProps) {
  const created = createdAt ? createdAt.slice(0, 10) : '-';
  return (
    <span
      data-testid="debug-card"
      title={`id: ${id}\norder: ${orderValue}\ncreated: ${createdAt ?? '-'}`}
      className="debug-card mr-1.5 inline-flex h-5 shrink-0 select-text items-center gap-1.5 rounded-sm border border-dot px-1.5 tabular-nums text-[10px] leading-5 text-ink-light"
      style={{ backgroundColor: 'var(--planner-control-bg)' }}
    >
      <span>{id.slice(0, 8)}</span>
      <span>#{orderValue}</span>
      <span>{created}</span>
    </span>
  );
}
