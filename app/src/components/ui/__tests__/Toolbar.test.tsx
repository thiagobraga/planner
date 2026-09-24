import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('renders a collapsed hamburger button and hides children until opened', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('reveals children in a dropdown panel when the hamburger is clicked', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('closes the panel on outside click', () => {
    render(
      <div>
        <Toolbar>
          <button>Today</button>
        </Toolbar>
        <button>Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('closes the panel on Escape', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
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
