import type { BoardGroupBy } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { CustomSelect } from './CustomSelect';

interface GroupBySelectProps {
  value: BoardGroupBy;
  onChange: (value: BoardGroupBy) => void;
  disabled?: boolean;
}

export function GroupBySelect({ value, onChange, disabled }: GroupBySelectProps) {
  const { t } = useI18n();
  return (
    <CustomSelect
      id="board-group-by"
      className="board-group-select"
      value={value}
      disabled={disabled}
      onChange={(next) => onChange(next as BoardGroupBy)}
      options={[
        { value: 'status', label: t('board.group.status') },
        { value: 'section', label: t('board.group.section') },
        { value: 'priority', label: t('board.group.priority') },
      ]}
    />
  );
}
