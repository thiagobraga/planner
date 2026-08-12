import { Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface AddColumnButtonProps {
  onClick?: () => void;
}

export function AddColumnButton({ onClick }: AddColumnButtonProps) {
  const { t } = useI18n();
  return (
    <button type="button" className="board-add-column" onClick={onClick}>
      <Plus size={16} />
      <span>{t('board.addColumn')}</span>
    </button>
  );
}
