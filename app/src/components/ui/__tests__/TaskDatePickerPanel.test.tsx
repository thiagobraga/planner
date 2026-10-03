import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskDatePickerPanel } from '../TaskDatePickerPanel';
import type { TaskSchedule } from '../../../types/task';

const empty: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  deadlineDate: null,
  deadlineTime: null,
  durationMinutes: null,
};

describe('TaskDatePickerPanel', () => {
  it('prefills the current schedule', () => {
    render(
      <TaskDatePickerPanel
        value={{ dueDate: '2026-08-14', dueTime: '14:30', deadlineDate: '2026-08-20', deadlineTime: '18:00', durationMinutes: 90 }}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-14');
    expect(screen.getByLabelText('Time')).toHaveValue('14:30');
    expect(screen.getByLabelText('Duration (min)')).toHaveValue(90);
    expect(screen.getByLabelText('Deadline')).toHaveValue('2026-08-20');
    expect(screen.getByLabelText('Deadline time')).toHaveValue('18:00');
  });

  it('submits the edited values', () => {
    const onSave = vi.fn();
    render(<TaskDatePickerPanel value={empty} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-14' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '09:15' } });
    fireEvent.change(screen.getByLabelText('Duration (min)'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2026-08-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      dueDate: '2026-08-14',
      dueTime: '09:15',
      deadlineDate: '2026-08-20',
      deadlineTime: null,
      durationMinutes: 30,
    });
  });

  it('disables a time until its date is set', () => {
    render(<TaskDatePickerPanel value={empty} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Time')).toBeDisabled();
    expect(screen.getByLabelText('Deadline time')).toBeDisabled();
  });

  it('drops a time whose date was cleared', () => {
    const onSave = vi.fn();
    render(<TaskDatePickerPanel value={{ ...empty, dueDate: '2026-08-14', dueTime: '10:00' }} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(empty);
  });

  it('clears every field', () => {
    const onSave = vi.fn();
    render(
      <TaskDatePickerPanel
        value={{ dueDate: '2026-08-14', dueTime: '14:30', deadlineDate: '2026-08-20', deadlineTime: null, durationMinutes: 45 }}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSave).toHaveBeenCalledWith(empty);
  });
});
