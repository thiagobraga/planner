import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ButtonGroup } from '../ButtonGroup';

describe('ButtonGroup', () => {
  describe('mode="single"', () => {
    const items = [
      { value: 'list' as const, label: 'List' },
      { value: 'kanban' as const, label: 'Kanban' },
    ];

    it('marks only the active item as pressed', () => {
      render(<ButtonGroup mode="single" value="list" onChange={vi.fn()} items={items} />);
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onChange with the clicked value', () => {
      const onChange = vi.fn();
      render(<ButtonGroup mode="single" value="list" onChange={onChange} items={items} />);
      fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith('kanban');
    });
  });

  describe('mode="multi"', () => {
    const items = [
      { value: 'completed' as const, label: 'Completed' },
      { value: 'notes' as const, label: 'Notes' },
    ];

    it('marks every value present in the array as pressed', () => {
      render(<ButtonGroup mode="multi" value={['completed']} onChange={vi.fn()} items={items} />);
      expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reports the clicked value regardless of current membership - caller owns the toggle', () => {
      const onChange = vi.fn();
      render(<ButtonGroup mode="multi" value={['completed']} onChange={onChange} items={items} />);
      fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
      expect(onChange).toHaveBeenCalledExactlyOnceWith('notes');
      fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
      expect(onChange).toHaveBeenCalledWith('completed');
    });
  });

  describe('rounding', () => {
    it('flattens only the touching side of each segment', () => {
      const items = [
        { value: 'a' as const, label: 'A' },
        { value: 'b' as const, label: 'B' },
        { value: 'c' as const, label: 'C' },
      ];
      render(<ButtonGroup mode="single" value="a" onChange={vi.fn()} items={items} size="xs" />);
      const [first, middle, last] = items.map((i) => screen.getByRole('button', { name: i.label }));

      // First keeps its left corners rounded, right corners flattened.
      expect(first.className).not.toMatch(/rounded-l-none/);
      expect(first.className).toMatch(/rounded-r-none/);
      // Middle segments are square on both touching sides.
      expect(middle.className).toMatch(/rounded-l-none/);
      expect(middle.className).toMatch(/rounded-r-none/);
      // Last keeps its right corners rounded, left corners flattened.
      expect(last.className).toMatch(/rounded-l-none/);
      expect(last.className).not.toMatch(/rounded-r-none/);
    });

    it('overlaps each non-first segment onto the previous border, avoiding a doubled seam', () => {
      const items = [
        { value: 'a' as const, label: 'A' },
        { value: 'b' as const, label: 'B' },
      ];
      render(<ButtonGroup mode="single" value="a" onChange={vi.fn()} items={items} />);
      const [first, second] = items.map((i) => screen.getByRole('button', { name: i.label }));

      expect(first.className).not.toMatch(/-ml-px/);
      expect(second.className).toMatch(/-ml-px/);
    });

    it('gets no corner overrides when there is only one segment', () => {
      render(
        <ButtonGroup mode="single" value="a" onChange={vi.fn()} items={[{ value: 'a' as const, label: 'A' }]} />,
      );
      const only = screen.getByRole('button', { name: 'A' });
      expect(only.className).not.toMatch(/rounded-l-none|rounded-r-none/);
    });
  });

  describe('disabled', () => {
    const items = [
      { value: 'a' as const, label: 'A' },
      { value: 'b' as const, label: 'B', disabled: true },
    ];

    it('does not fire onChange when the whole group is disabled', () => {
      const onChange = vi.fn();
      render(<ButtonGroup mode="single" value="a" onChange={onChange} items={items} disabled />);
      fireEvent.click(screen.getByRole('button', { name: 'A' }));
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'A' })).toBeDisabled();
    });

    it('does not fire onChange for an individually disabled item', () => {
      const onChange = vi.fn();
      render(<ButtonGroup mode="single" value="a" onChange={onChange} items={items} />);
      fireEvent.click(screen.getByRole('button', { name: 'B' }));
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'B' })).toBeDisabled();
    });
  });

  describe('labels and icons', () => {
    it('shows text for a label-only item with no icon', () => {
      render(
        <ButtonGroup
          mode="single"
          value="today"
          onChange={vi.fn()}
          items={[
            { value: 'today' as const, label: 'Today' },
            { value: 'upcoming' as const, label: 'Upcoming' },
          ]}
        />,
      );
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('hides text for an icon item unless showLabel is set, but keeps the accessible name', () => {
      render(
        <ButtonGroup
          mode="single"
          value="timeline"
          onChange={vi.fn()}
          items={[
            { value: 'timeline' as const, label: 'Timeline view', icon: <span data-testid="icon-t" /> },
            {
              value: 'calendar' as const,
              label: 'Calendar view',
              icon: <span data-testid="icon-c" />,
              showLabel: true,
            },
          ]}
        />,
      );
      expect(screen.queryByText('Timeline view')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Timeline view' })).toBeInTheDocument();
      expect(screen.getByText('Calendar view')).toBeInTheDocument();
    });
  });

  it('applies an aria-label to the group container', () => {
    render(
      <ButtonGroup
        mode="single"
        value="a"
        onChange={vi.fn()}
        items={[{ value: 'a' as const, label: 'A' }]}
        aria-label="View mode"
      />,
    );
    expect(screen.getByRole('group', { name: 'View mode' })).toBeInTheDocument();
  });
});
