import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('renders input with placeholder', () => {
    render(<FilterBar />);
    expect(screen.getByPlaceholderText(/Filter/i)).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<FilterBar onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: /filter tasks/i });
    fireEvent.change(input, { target: { value: 'today' } });
    expect(onChange).toHaveBeenCalledWith('today');
  });

  it('calls onApply when Enter is pressed with valid filter', () => {
    const onApply = vi.fn();
    render(<FilterBar value="today" onApply={onApply} />);
    const input = screen.getByRole('textbox', { name: /filter tasks/i });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith('today');
  });

  it('does not call onApply when Enter is pressed with empty input', () => {
    const onApply = vi.fn();
    render(<FilterBar onApply={onApply} />);
    const input = screen.getByRole('textbox', { name: /filter tasks/i });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('does not call onApply when Enter is pressed with invalid filter', () => {
    const onApply = vi.fn();
    render(<FilterBar value="(" onApply={onApply} />);
    const input = screen.getByRole('textbox', { name: /filter tasks/i });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows clear button when there is a value', () => {
    render(<FilterBar value="test" />);
    expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument();
  });

  it('calls onChange and onApply when clear button is clicked', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    render(<FilterBar value="test" onChange={onChange} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /clear filter/i }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onApply).toHaveBeenCalledWith('');
  });

  it('shows validation error for unclosed parenthesis', () => {
    render(<FilterBar value="(" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unclosed parenthesis/i);
  });

  it('shows validation error for unmatched closing parenthesis', () => {
    render(<FilterBar value=")" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unmatched closing parenthesis/i);
  });

  it('shows validation error for consecutive operators', () => {
    render(<FilterBar value="today && overdue" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/consecutive operators/i);
  });

  it('shows validation error for empty group', () => {
    render(<FilterBar value="()" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/empty group/i);
  });

  it('sets aria-invalid when there is an error', () => {
    render(<FilterBar value="(" />);
    expect(screen.getByRole('textbox', { name: /filter tasks/i })).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears error when value becomes valid', () => {
    const { rerender } = render(<FilterBar value="(" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<FilterBar value="today" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('syntax-highlights tokens with keyword class', () => {
    const { container } = render(<FilterBar value="#work" />);
    const keywordSpan = container.querySelector('.text-accent');
    expect(keywordSpan).toBeInTheDocument();
    expect(keywordSpan).toHaveTextContent('#work');
  });
});
