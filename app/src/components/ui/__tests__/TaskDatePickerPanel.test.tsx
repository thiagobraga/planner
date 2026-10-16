import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDatePickerPanel } from '../TaskDatePickerPanel';
import type { TaskSchedule } from '../../../types/task';
import { apiParseDate } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiParseDate: vi.fn(),
  fetchPreferences: vi.fn(),
}));

const parse = vi.mocked(apiParseDate);

const empty: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  deadlineDate: null,
  deadlineTime: null,
  durationMinutes: null,
  recurrenceRule: null,
};

function renderPanel(value: Partial<TaskSchedule> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const client = new QueryClient();
  client.setQueryData(['preferences'], { weekStart: 'monday' });
  render(
    <QueryClientProvider client={client}>
      <TaskDatePickerPanel value={{ ...empty, ...value }} onSave={onSave} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onSave, onClose };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const save = () => click('Save');

describe('TaskDatePickerPanel', () => {
  beforeEach(() => {
    // Thursday 2026-10-15
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    parse.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('date screen', () => {
    it('lists quick options with their resolved dates and saves the one picked', () => {
      const { onSave } = renderPanel({ durationMinutes: 30 });

      expect(screen.getByRole('button', { name: /Today/ })).toHaveTextContent('Thu, Oct 15');
      expect(screen.getByRole('button', { name: /This weekend/ })).toHaveTextContent('Sat, Oct 17');
      expect(screen.getByRole('button', { name: /Next week/ })).toHaveTextContent('Mon, Oct 19');

      click(/Tomorrow/);
      save();

      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-16', durationMinutes: 30 });
    });

    it('picks a day from the calendar', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-15' });

      fireEvent.click(document.querySelector('[data-date="2026-10-28"]')!);
      expect(document.querySelector('[data-date="2026-10-28"]')).toHaveAttribute('aria-pressed', 'true');
      save();

      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-28' });
    });

    it('previews typed text and applies it with Enter', async () => {
      parse.mockResolvedValue({ date: '2026-10-17', time: '09:00', recurrence: { type: 'weekly', interval: 1, weekdays: [6] } });
      const { onSave } = renderPanel();

      const input = screen.getByRole('textbox', { name: /Type a date/ });
      fireEvent.change(input, { target: { value: 'every saturday 9am' } });
      expect(await screen.findByText('Sat, Oct 17 · 09:00 · Every week on Saturday')).toBeInTheDocument();
      expect(parse).toHaveBeenCalledWith('every saturday 9am', 'en', expect.any(AbortSignal));

      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input).toHaveValue('');
      save();

      expect(onSave).toHaveBeenCalledWith({
        ...empty,
        dueDate: '2026-10-17',
        dueTime: '09:00',
        recurrenceRule: { type: 'weekly', interval: 1, weekdays: [6] },
      });
    });

    it('says so when the typed text holds no date', async () => {
      parse.mockResolvedValue(null);
      renderPanel();

      fireEvent.change(screen.getByRole('textbox', { name: /Type a date/ }), { target: { value: 'someday' } });

      expect(await screen.findByText('No date found in that text')).toBeInTheDocument();
    });

    it('shows the time and repeat already set on the buttons', () => {
      renderPanel({ dueDate: '2026-10-17', dueTime: '09:00', durationMinutes: 30, recurrenceRule: { type: 'daily', interval: 1 } });

      expect(screen.getByRole('button', { name: /Add time: 09:00 · 30 min/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Repeat: Every day/ })).toBeInTheDocument();
    });

    it('removes date, time, deadline and repeat at once', () => {
      const { onSave } = renderPanel({
        dueDate: '2026-10-17',
        dueTime: '09:00',
        deadlineDate: '2026-10-19',
        durationMinutes: 30,
        recurrenceRule: { type: 'daily', interval: 1 },
      });

      click('Remove date');

      expect(onSave).toHaveBeenCalledWith(empty);
    });

    it('drops a time that has no date', () => {
      const { onSave } = renderPanel({ dueTime: '10:00', deadlineTime: '18:00' });
      save();
      expect(onSave).toHaveBeenCalledWith(empty);
    });

    it('closes from the header', () => {
      const { onClose, onSave } = renderPanel();
      click('Close');
      expect(onClose).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('time and deadline screen', () => {
    it('sets start, duration preset and deadline, then saves everything', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17' });

      click(/Add time/);
      expect(screen.getByRole('heading', { name: 'Time and deadline' })).toBeInTheDocument();
      expect(screen.getByText('Saturday, October 17')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '09:00' } });
      click('30 min');
      expect(screen.getByText('Ends at 09:30')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Duration' })).toHaveValue('30');

      fireEvent.click(screen.getByRole('switch'));
      expect(screen.getByLabelText('Deadline date')).toHaveValue('2026-10-17');
      fireEvent.change(screen.getByLabelText('Deadline date'), { target: { value: '2026-10-19' } });
      fireEvent.change(screen.getByLabelText('Deadline time'), { target: { value: '18:00' } });

      save();

      expect(onSave).toHaveBeenCalledWith({
        ...empty,
        dueDate: '2026-10-17',
        dueTime: '09:00',
        durationMinutes: 30,
        deadlineDate: '2026-10-19',
        deadlineTime: '18:00',
      });
    });

    it('dates the task today when adding a time to an undated task', () => {
      renderPanel();
      click(/Add time/);
      expect(screen.getByText('Thursday, October 15')).toBeInTheDocument();
    });

    it('opens with the deadline switched on from the deadline row', () => {
      renderPanel({ dueDate: '2026-10-17' });
      click(/Deadline/);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('turns the deadline off', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17', deadlineDate: '2026-10-19', deadlineTime: '18:00' });
      click(/Deadline/);
      fireEvent.click(screen.getByRole('switch'));
      save();
      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-17' });
    });

    it('discards its edits on Cancel and keeps them on Back', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17' });

      click(/Add time/);
      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '07:00' } });
      click('Cancel');
      expect(screen.getByRole('heading', { name: 'Set date' })).toBeInTheDocument();

      click(/Add time/);
      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '08:00' } });
      click('Back');
      save();

      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-17', dueTime: '08:00' });
    });

    it('goes back on Escape instead of closing the menu', () => {
      renderPanel({ dueDate: '2026-10-17' });
      click(/Add time/);
      fireEvent.keyDown(screen.getByLabelText('Start'), { key: 'Escape' });
      expect(screen.getByRole('heading', { name: 'Set date' })).toBeInTheDocument();
    });
  });

  describe('repeat screen', () => {
    it('offers the weekly preset on the task weekday', () => {
      renderPanel({ dueDate: '2026-10-17' });
      click(/Repeat/);
      expect(screen.getByLabelText('Every week on Saturday')).toBeInTheDocument();
      expect(screen.getByLabelText("Don't repeat")).toBeChecked();
    });

    it('builds every 2 weeks on Saturday counted from completion', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17' });

      click(/Repeat/);
      fireEvent.click(screen.getByLabelText('Custom'));
      fireEvent.change(screen.getByLabelText('Interval'), { target: { value: '2' } });
      expect(screen.getByRole('button', { name: 'Saturday' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('radio', { name: 'Completion' }));
      expect(screen.getByTestId('recurrence-summary')).toHaveTextContent('Every 2 weeks on Saturdays, after completion');

      save();
      expect(screen.getByRole('button', { name: /Repeat: Every 2 weeks on Saturdays, after completion/ })).toBeInTheDocument();
      save();

      expect(onSave).toHaveBeenCalledWith({
        ...empty,
        dueDate: '2026-10-17',
        recurrenceRule: { type: 'weekly', interval: 2, weekdays: [6], fromCompletion: true },
      });
    });

    it('picks several weekdays and an end date', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17' });

      click(/Repeat/);
      fireEvent.click(screen.getByLabelText('Custom'));
      fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
      fireEvent.click(screen.getByLabelText('On a date'));
      expect(screen.getByLabelText('End date')).toHaveValue('2026-11-17');
      fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-31' } });
      save();
      save();

      expect(onSave).toHaveBeenCalledWith({
        ...empty,
        dueDate: '2026-10-17',
        recurrenceRule: { type: 'weekly', interval: 1, weekdays: [1, 6], until: '2026-12-31' },
      });
    });

    it('reads an existing weekdays rule back as its preset', () => {
      renderPanel({ dueDate: '2026-10-19', recurrenceRule: { type: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] } });
      click(/Repeat/);
      const group = screen.getByRole('radiogroup', { name: 'Repeat' });
      expect(within(group).getByRole('radio', { checked: true }).closest('label')).toHaveTextContent('Weekdays');
    });

    it('keeps the old rule on Cancel', () => {
      const { onSave } = renderPanel({ dueDate: '2026-10-17', recurrenceRule: { type: 'daily', interval: 1 } });
      click(/Repeat/);
      fireEvent.click(screen.getByLabelText("Don't repeat"));
      click('Cancel');
      save();
      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-17', recurrenceRule: { type: 'daily', interval: 1 } });
    });

    it('dates an undated task today when a repeat is saved', () => {
      const { onSave } = renderPanel();
      click(/Repeat/);
      fireEvent.click(screen.getByLabelText('Every day'));
      save();
      save();
      expect(onSave).toHaveBeenCalledWith({ ...empty, dueDate: '2026-10-15', recurrenceRule: { type: 'daily', interval: 1 } });
    });
  });
});
