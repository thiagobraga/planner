import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('renders its children', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('carries the page-header-toolbar class the header CSS targets', () => {
    const { container } = render(
      <Toolbar>
        <span>content</span>
      </Toolbar>,
    );
    expect(container.firstElementChild).toHaveClass('page-header-toolbar');
  });

  it('merges a page-specific className alongside its own base classes', () => {
    const { container } = render(
      <Toolbar className="daily-page-header-controls">
        <span>content</span>
      </Toolbar>,
    );
    expect(container.firstElementChild).toHaveClass('page-header-toolbar', 'daily-page-header-controls');
  });
});
