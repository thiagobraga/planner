import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColumnDeleteModal } from '../ColumnDeleteModal';
import { useI18n } from '../../../i18n/I18nContext';

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: vi.fn(() => ({ t: (key: string) => key })),
}));

const mockUseI18n = vi.mocked(useI18n);

function renderModal(props: Partial<React.ComponentProps<typeof ColumnDeleteModal>> = {}) {
  const onDelete = props.onDelete ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();

  return render(
    <ColumnDeleteModal
      isOpen={props.isOpen ?? true}
      title={props.title ?? 'Doing'}
      message={props.message ?? 'This column has 3 task(s). Choose a status to move them to before deleting it.'}
      reassignOptions={props.reassignOptions ?? [{ value: 'done', label: 'Done' }]}
      selectedReassignToId={props.selectedReassignToId ?? 'done'}
      errorMessage={props.errorMessage ?? null}
      onChangeReassignToId={props.onChangeReassignToId ?? vi.fn()}
      onDelete={onDelete}
      onCancel={onCancel}
    />,
  );
}

describe('ColumnDeleteModal', () => {
  it('renders the title, message and action buttons', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'board.deleteColumnTitle' })).toBeInTheDocument();
    expect(screen.getByText('This column has 3 task(s). Choose a status to move them to before deleting it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
  });

  it('shows the reassignment select when options are provided', () => {
    renderModal();

    expect(screen.getByLabelText('board.reassignTasksTo')).toHaveValue('done');
  });

  it('renders the API error message when present', () => {
    renderModal({ errorMessage: 'Cannot delete the last status in a collection' });

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete the last status in a collection');
  });

  it('closes on Escape and overlay click', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not render when closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockUseI18n).toHaveBeenCalled();
  });
});
