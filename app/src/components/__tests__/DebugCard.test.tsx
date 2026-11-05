import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebugCard } from '../DebugCard';

describe('DebugCard', () => {
  it('shows short id, order and created date', () => {
    render(<DebugCard id="12345678-aaaa-bbbb-cccc-dddddddddddd" orderValue={3} createdAt="2026-10-17T05:00:00.000Z" />);
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('ID: 12345678');
    expect(card).toHaveTextContent('Order: 3');
    expect(card).toHaveTextContent(/Created: 2026-10-1[67]-\d\d-\d\d-\d\d/);
    expect(card).toHaveAttribute('title', expect.stringContaining('12345678-aaaa-bbbb-cccc-dddddddddddd'));
  });

  it('shows a dash when created date is missing', () => {
    render(<DebugCard id="abc" orderValue={0} />);
    expect(screen.getByTestId('debug-card')).toHaveTextContent('Created: -');
  });

  it('shows level and a short parent id', () => {
    render(<DebugCard id="abc" orderValue={0} level={2} parentId="fedcba98-7654" />);
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('Level: 2');
    expect(card).toHaveTextContent('Parent: fedcba98');
    expect(card).toHaveAttribute('title', expect.stringContaining('parent: fedcba98-7654'));
  });

  it('shows a dash for a root item without a parent', () => {
    render(<DebugCard id="abc" orderValue={0} level={0} parentId={null} />);
    const card = screen.getByTestId('debug-card');
    expect(card).toHaveTextContent('Level: 0');
    expect(card).toHaveTextContent('Parent: -');
  });
});
