import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardColumn } from '../BoardColumn';

describe('BoardColumn', () => {
  it('exposes the column id, task count, and empty target', () => {
    const { container } = render(
      <BoardColumn
        column={{ id: 'status:todo', value: 'todo', title: 'Todo', color: '#adb9c1', tasks: [] }}
        allTasks={[]}
      />,
    );

    expect(container.querySelector('[data-column-id="status:todo"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();
    expect(screen.getByText('Drop work here')).toBeInTheDocument();
  });
});
