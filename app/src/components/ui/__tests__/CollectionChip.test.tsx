import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollectionChip } from '../Chip';

describe('CollectionChip', () => {
  it('shows the section beside the collection name', () => {
    render(<CollectionChip name="finance" section="Bills" />);
    expect(screen.getByText('finance')).toBeInTheDocument();
    expect(screen.getByText('Bills')).toBeInTheDocument();
  });

  it('omits the section part when there is none', () => {
    const { container } = render(<CollectionChip name="finance" />);
    expect(container.querySelector('.ui-collection-chip-section')).toBeNull();
  });
});
