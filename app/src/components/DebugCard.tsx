import type { DebugCardProps } from '../types/debug';

const pad = (n: number) => String(n).padStart(2, '0');

function formatCreated(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export function DebugCard({ id, orderValue, createdAt }: DebugCardProps) {
  const chip = 'inline-flex h-5 items-center rounded-sm border border-dot px-1.5';
  const chipStyle = { backgroundColor: 'var(--planner-control-bg)' };
  return (
    <span
      data-testid="debug-card"
      title={`id: ${id}\norder: ${orderValue}\ncreated: ${createdAt ?? '-'}`}
      className="debug-card ml-1.5 inline-flex shrink-0 select-text items-center gap-1 tabular-nums text-[10px] leading-5 text-ink-light"
    >
      <span className={chip} style={chipStyle}>ID: {id.slice(0, 8)}</span>
      <span className={chip} style={chipStyle}>Order: {orderValue}</span>
      <span className={chip} style={chipStyle}>Created: {formatCreated(createdAt)}</span>
    </span>
  );
}
