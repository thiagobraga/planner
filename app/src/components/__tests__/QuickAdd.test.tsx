import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickAdd } from '../QuickAdd';
import * as dateUtils from '../../utils/date';

vi.mock('../../utils/date', () => ({
  parseNaturalDate: vi.fn(),
  extractNaturalDate: vi.fn(),
}));

describe('QuickAdd', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <QuickAdd isOpen={false} onClose={onClose} onSubmit={onSubmit} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with input when open', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Task title')).toBeInTheDocument();
    expect(screen.getByText('Quick Add')).toBeInTheDocument();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('typing text updates input value', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'buy groceries' } });
    expect(input.value).toBe('buy groceries');
  });

  it('submit button is disabled when input is empty', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const btn = screen.getByRole('button', { name: 'Add Task' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submitting calls onSubmit with title', () => {
    vi.mocked(dateUtils.parseNaturalDate).mockReturnValue(null);
    vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({ title: 'buy groceries' });

    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title');
    fireEvent.change(input, { target: { value: 'buy groceries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('buy groceries', undefined, 'en');
    expect(onSubmit).toHaveBeenCalledWith('buy groceries', undefined, undefined, 'task');
    expect(onClose).toHaveBeenCalled();
  });

  it('submitting calls onSubmit with extracted date', () => {
    const fakeParsed = { text: 'today', preview: 'Today, Jul 20', isoDate: '2026-07-20' };
    vi.mocked(dateUtils.parseNaturalDate).mockReturnValue(fakeParsed);
    vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({
      title: 'call mom',
      dueDate: '2026-07-20',
    });

    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title');
    fireEvent.change(input, { target: { value: 'call mom today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(onSubmit).toHaveBeenCalledWith('call mom', '2026-07-20', undefined, 'task');
  });

  it('shows NLP date preview when date is parsed', () => {
    const fakeParsed = { text: 'tomorrow', preview: 'Tomorrow, Jul 21', isoDate: '2026-07-21' };
    vi.mocked(dateUtils.parseNaturalDate).mockReturnValue(fakeParsed);

    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title');
    fireEvent.change(input, { target: { value: 'meeting tomorrow' } });

    expect(screen.getByText(/Recognized:/)).toBeInTheDocument();
    expect(screen.getByText('Tomorrow, Jul 21')).toBeInTheDocument();
  });

  it('does not show NLP preview when date parsing returns null', () => {
    vi.mocked(dateUtils.parseNaturalDate).mockReturnValue(null);

    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title');
    fireEvent.change(input, { target: { value: 'plain task' } });

    expect(screen.queryByText(/Recognized:/)).not.toBeInTheDocument();
  });

  it('Escape key calls onClose', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Task title');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking overlay background calls onClose', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit empty input', () => {
    render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe('BuJo prefix detection', () => {
    beforeEach(() => {
      vi.mocked(dateUtils.parseNaturalDate).mockReturnValue(null);
    });

    it('strips a leading "( " prefix and submits type event', () => {
      vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({ title: 'Team standup' });

      render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
      const input = screen.getByLabelText('Task title');
      fireEvent.change(input, { target: { value: '( Team standup' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

      expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('Team standup', undefined, 'en');
      expect(onSubmit).toHaveBeenCalledWith('Team standup', undefined, undefined, 'event');
    });

    it('strips a leading "- " prefix and submits type note', () => {
      vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({ title: 'Shopping list' });

      render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
      const input = screen.getByLabelText('Task title');
      fireEvent.change(input, { target: { value: '- Shopping list' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

      expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('Shopping list', undefined, 'en');
      expect(onSubmit).toHaveBeenCalledWith('Shopping list', undefined, undefined, 'note');
    });

    it('strips a leading "* " prefix and keeps type task', () => {
      vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({ title: 'Buy groceries' });

      render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
      const input = screen.getByLabelText('Task title');
      fireEvent.change(input, { target: { value: '* Buy groceries' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

      expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('Buy groceries', undefined, 'en');
      expect(onSubmit).toHaveBeenCalledWith('Buy groceries', undefined, undefined, 'task');
    });

    it('leaves a marker alone when it is not followed by whitespace', () => {
      vi.mocked(dateUtils.extractNaturalDate).mockReturnValue({ title: '(parenthetical) note' });

      render(<QuickAdd isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
      const input = screen.getByLabelText('Task title');
      fireEvent.change(input, { target: { value: '(parenthetical) note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

      expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('(parenthetical) note', undefined, 'en');
      expect(onSubmit).toHaveBeenCalledWith('(parenthetical) note', undefined, undefined, 'task');
    });
  });
});
