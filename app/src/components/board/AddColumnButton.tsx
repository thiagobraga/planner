import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { InlineNameInput } from '../ui/InlineNameInput';

interface AddColumnButtonProps {
  onAdd?: (name: string) => void;
}

export function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <div className="board-add-column board-add-column-input" data-testid="board-add-column-input">
        <InlineNameInput
          defaultValue=""
          placeholder={t('board.columnName')}
          onCommit={(name) => {
            setAdding(false);
            if (name) onAdd?.(name);
          }}
          onCancel={() => setAdding(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="board-add-column"
      data-testid="board-add-column"
      onClick={() => setAdding(true)}
    >
      <Plus size={16} />
      <span>{t('board.addColumn')}</span>
    </button>
  );
}
