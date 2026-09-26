import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardToolbar } from '../BoardToolbar';

const baseProps = {
  groupBy: 'status' as const,
  hideCompletedTasks: false,
  showNotes: true,
  preferencesDisabled: false,
  onGroupByChange: vi.fn(),
  onHideCompletedTasksChange: vi.fn(),
  onShowNotesChange: vi.fn(),
};

describe('BoardToolbar', () => {
  it('keeps the list toolbar to visibility controls only (view switch lives in the header)', () => {
    render(<BoardToolbar {...baseProps} view="list" />);

    const toolbar = screen.getByRole('checkbox', { name: 'Notes' }).closest('.board-page-toolbar');
    expect(toolbar).not.toBeNull();
    expect(within(toolbar!).queryAllByRole('button')).toEqual([]);
    expect(within(toolbar!).queryByText('View')).not.toBeInTheDocument();
    expect(within(toolbar!).getByRole('checkbox', { name: 'Completed tasks' })).toBeInTheDocument();
    expect(within(toolbar!).getByRole('checkbox', { name: 'Notes' })).toBeInTheDocument();
    expect(within(toolbar!).queryByText('Group by')).not.toBeInTheDocument();
  });

  it('shows only the group control and visibility controls in kanban', () => {
    render(<BoardToolbar {...baseProps} view="kanban" />);

    const toolbar = screen.getByText('Group by').closest('.board-page-toolbar');
    expect(toolbar).not.toBeNull();
    const buttons = within(toolbar!).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim())).toEqual([
      'Status',
    ]);
  });
});
