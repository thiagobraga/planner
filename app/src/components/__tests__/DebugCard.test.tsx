import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebugCard } from '../DebugCard';

describe('DebugCard', () => {
  it('shows short id, order and created date', () => {
    render(<DebugCard id="12345678-aaaa-bbbb-cccc-dddddddddddd" orderValue={3} createdAt="2026-10-17T05:00:00.000Z" />);
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('12345678');
    expect(card).toHaveTextContent('#3');
    expect(card).toHaveTextContent('2026-10-17');
    expect(card).toHaveAttribute('title', expect.stringContaining('12345678-aaaa-bbbb-cccc-dddddddddddd'));
  });

  it('shows a dash when created date is missing', () => {
    render(<DebugCard id="abc" orderValue={0} />);
    expect(screen.getByTestId('debug-card')).toHaveTextContent('-');
  });
});
