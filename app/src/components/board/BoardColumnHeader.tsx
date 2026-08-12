import { useI18n } from '../../i18n/I18nContext';

interface BoardColumnHeaderProps {
  title: string;
  count: number;
  color?: string;
}

export function BoardColumnHeader({ title, count, color }: BoardColumnHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="board-column-header">
      <span className="board-column-dot" style={{ backgroundColor: color ?? 'var(--color-ink-lighter)' }} />
      <h2>{title}</h2>
      {count > 0 && <span className="board-column-count">{count}</span>}
      <button
        type="button"
        aria-label={t('board.moreOptions', { title })}
        className="board-column-menu"
      >
        ···
      </button>
    </header>
  );
}
