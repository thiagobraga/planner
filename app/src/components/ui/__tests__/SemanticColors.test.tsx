import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { StatusPill } from '../StatusPill';
import { PriorityDot } from '../PriorityDot';
import { ContextMenu } from '../ContextMenu';
import { TaskDetail } from '../../TaskDetail';
import { CustomSelect } from '../CustomSelect';
import { AuthFormError } from '../../AuthShell';

describe('semantic state colors', () => {
  it('keeps destructive actions and validation separate from the action accent', () => {
    const { container } = render(<>
      <Button variant="destructive">Delete task</Button>
      <Input aria-label="Title" error errorText="Title is required" />
      <Select aria-label="Collection" error><option>Inbox</option></Select>
      <StatusPill status="blocked" />
      <PriorityDot priority={1} />
      <CustomSelect label="Status" options={[]} error errorText="Choose a status" />
      <AuthFormError>Sign-in failed</AuthFormError>
    </>);

    expect(screen.getByRole('button', { name: 'Delete task' })).toHaveClass('text-danger-text', 'border-danger');
    expect(screen.getByText('Title is required')).toHaveClass('text-danger-text');
    expect(container.querySelector('.ui-input-container')).toHaveClass('border-danger');
    expect(container.querySelector('.ui-select')).toHaveClass('border-danger');
    expect(screen.getByText('Blocked')).toHaveClass('text-danger-text');
    expect(container.querySelector('.ui-priority-dot-circle')).toHaveClass('bg-danger');
    expect(screen.getByText('Choose a status')).toHaveClass('text-danger-text');
    expect(screen.getByRole('alert')).toHaveClass('text-danger-text');
  });

  it('uses a danger foreground for destructive menu actions', () => {
    render(<ContextMenu position={{ x: 24, y: 24 }} onClose={vi.fn()} items={[
      { type: 'item', label: 'Delete', destructive: true, onClick: vi.fn() },
    ]} />);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('text-danger-text');
  });

  it('pairs selected priority fills with their theme-aware foregrounds', () => {
    render(<TaskDetail onClose={vi.fn()} task={{
      id: 'task-1', title: 'Prioritized task', priority: 1,
      isCompleted: false, orderValue: 1, type: 'task',
    }} />);

    const expected = [
      ['P1', 'bg-danger', 'text-on-danger'],
      ['P2', 'bg-priority-2', 'text-on-warning'],
      ['P3', 'bg-priority-3', 'text-on-info'],
      ['P4', 'bg-ink', 'text-cream'],
    ];
    for (const [name, background, foreground] of expected) {
      const button = screen.getByRole('button', { name, exact: true });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass(background, foreground);
      expect(button).not.toHaveClass('text-white');
    }
  });
});
