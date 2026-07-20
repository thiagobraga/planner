import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Checkbox } from '../ui/Checkbox';
import { Chip } from '../ui/Chip';
import { ContextMenu } from '../ui/ContextMenu';
import { CustomSelect } from '../ui/CustomSelect';
import { PriorityDot } from '../ui/PriorityDot';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';
import { ViewToolbar } from '../ui/ViewToolbar';

describe('Checkbox', () => {
  it('renders unchecked state by default', () => {
    const { container } = render(<Checkbox label="Unchecked" />);
    const input = container.querySelector('.ui-checkbox-input') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it('renders checked state', () => {
    const { container } = render(<Checkbox label="Checked" checked />);
    const input = container.querySelector('.ui-checkbox-input') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('renders disabled state', () => {
    const { container } = render(<Checkbox label="Disabled" disabled />);
    const input = container.querySelector('.ui-checkbox-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('fires onChange when clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<Checkbox label="Clickable" onChange={onChange} />);
    const input = container.querySelector('.ui-checkbox-input') as HTMLInputElement;
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Chip', () => {
  it('renders children text', () => {
    render(<Chip>Label text</Chip>);
    expect(screen.getByText('Label text')).toBeInTheDocument();
  });
});

describe('ContextMenu', () => {
  it('renders menu items', () => {
    render(
      <ContextMenu
        position={{ x: 0, y: 0 }}
        onClose={vi.fn()}
        items={[
          { type: 'item', label: 'Edit', onClick: vi.fn() },
          { type: 'item', label: 'Delete' },
        ]}
      />
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('fires item onClick when menu item is clicked', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        position={{ x: 0, y: 0 }}
        onClose={onClose}
        items={[{ type: 'item', label: 'Edit', onClick }]}
      />
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when menu item is clicked', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        position={{ x: 0, y: 0 }}
        onClose={onClose}
        items={[{ type: 'item', label: 'Edit', onClick }]}
      />
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CustomSelect', () => {
  it('renders with placeholder', () => {
    render(
      <CustomSelect
        alwaysOpen
        placeholder="Choose..."
        options={[{ value: 'a', label: 'Option A' }]}
      />
    );
    expect(screen.getByText('Choose...')).toBeInTheDocument();
  });

  it('renders options', () => {
    render(
      <CustomSelect
        alwaysOpen
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />
    );
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });

  it('fires onChange when option is selected', () => {
    const onChange = vi.fn();
    render(
      <CustomSelect
        alwaysOpen
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('option', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('PriorityDot', () => {
  it('renders P1 with accent color', () => {
    const { container } = render(<PriorityDot priority={1} />);
    const dot = container.querySelector('.ui-priority-dot-circle');
    expect(dot).toHaveClass('bg-accent');
  });

  it('renders P4 with ink color', () => {
    const { container } = render(<PriorityDot priority={4} />);
    const dot = container.querySelector('.ui-priority-dot-circle');
    expect(dot).toHaveClass('bg-ink');
  });
});

describe('Select', () => {
  it('renders options', () => {
    render(
      <Select>
        <option value="">Select...</option>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('fires onChange when selection changes', () => {
    const onChange = vi.fn();
    render(
      <Select data-testid="native-select" onChange={onChange}>
        <option value="">Select...</option>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    fireEvent.change(screen.getByTestId('native-select'), { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows selected value', () => {
    render(
      <Select data-testid="native-select" value="b" onChange={vi.fn()}>
        <option value="">Select...</option>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    const select = screen.getByTestId('native-select') as HTMLSelectElement;
    expect(select.value).toBe('b');
  });
});

describe('StatusPill', () => {
  it.each([
    ['open', 'Open'],
    ['in_progress', 'In progress'],
    ['done', 'Done'],
    ['blocked', 'Blocked'],
  ] as const)('renders "%s" status as "%s"', (status, expected) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('ViewToolbar', () => {
  it('renders toolbar elements', () => {
    render(<ViewToolbar />);
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Show completed')).toBeInTheDocument();
    expect(screen.getByText('Move completed to end')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
  });

  it('calls onFilter when Filter button is clicked', () => {
    const onFilter = vi.fn();
    render(<ViewToolbar onFilter={onFilter} />);
    fireEvent.click(screen.getByText('Filter'));
    expect(onFilter).toHaveBeenCalledTimes(1);
  });

  it('calls onViewChange when Kanban is clicked', () => {
    const onViewChange = vi.fn();
    render(<ViewToolbar onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Kanban'));
    expect(onViewChange).toHaveBeenCalledWith('kanban');
  });

  it('calls onShowCompletedChange when checkbox is toggled', () => {
    const onShowCompletedChange = vi.fn();
    const { container } = render(
      <ViewToolbar onShowCompletedChange={onShowCompletedChange} />
    );
    const inputs = container.querySelectorAll('.ui-checkbox-input');
    fireEvent.click(inputs[0]);
    expect(onShowCompletedChange).toHaveBeenCalledTimes(1);
  });
});
