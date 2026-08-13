import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardToolbar } from '../BoardToolbar';

const baseProps = {
  groupBy: 'status' as const,
  hideCompletedTasks: false,
  hideOldNotes: false,
  preferencesDisabled: false,
  onViewChange: vi.fn(),
  onGroupByChange: vi.fn(),
  onHideCompletedTasksChange: vi.fn(),
  onHideOldNotesChange: vi.fn(),
};

describe('BoardToolbar', () => {
  it('keeps the list toolbar to the view switch followed by visibility controls', () => {
    render(<BoardToolbar {...baseProps} view="list" />);

    const toolbar = screen.getByText('List').closest('.board-page-toolbar');
    expect(toolbar).not.toBeNull();
    expect(within(toolbar!).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'List',
      'Kanban',
      '',
      '',
    ]);
    expect(within(toolbar!).queryByText('Group by')).not.toBeInTheDocument();
  });

  it('orders group controls, view switch, and visibility controls in kanban', () => {
    render(<BoardToolbar {...baseProps} view="kanban" />);

    const toolbar = screen.getByText('Group by').closest('.board-page-toolbar');
    expect(toolbar).not.toBeNull();
    const buttons = within(toolbar!).getAllByRole('button');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Status',
      'List',
      'Kanban',
      '',
      '',
    ]);
  });
});
