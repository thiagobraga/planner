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

    expect(dateUtils.extractNaturalDate).toHaveBeenCalledWith('buy groceries');
    expect(onSubmit).toHaveBeenCalledWith('buy groceries', undefined, undefined);
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

    expect(onSubmit).toHaveBeenCalledWith('call mom', '2026-07-20', undefined);
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
});
