import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';
import { Toolbar } from '../ui/Toolbar';

describe('PageHeader', () => {
  it('renders a string title as the h1', () => {
    render(<PageHeader title="Daily" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Daily' })).toBeInTheDocument();
  });

  it('renders a custom node title (e.g. a breadcrumb trail)', () => {
    render(
      <PageHeader
        title={
          <>
            <span>Work</span>
            <span>Sub-project</span>
          </>
        }
      />,
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Sub-project')).toBeInTheDocument();
  });

  it('does not render the subtitle even when provided', () => {
    render(<PageHeader title="Daily" subtitle="A phrase for today" />);
    expect(screen.queryByText('A phrase for today')).not.toBeInTheDocument();
  });

  it('omits the subtitle paragraph', () => {
    const { container } = render(<PageHeader title="Daily" subtitle="A phrase for today" />);
    expect(container.querySelector('.page-header-subtitle')).not.toBeInTheDocument();
  });

  it('renders the toolbar slot as-is, without wrapping it in its own div', () => {
    const { container } = render(
      <PageHeader
        title="Daily"
        toolbar={
          <Toolbar className="daily-page-header-controls">
            <button>Today</button>
          </Toolbar>
        }
      />,
    );
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    // Exactly one .page-header-toolbar - PageHeader doesn't add a second wrapper.
    expect(container.querySelectorAll('.page-header-toolbar')).toHaveLength(1);
    expect(container.querySelector('.page-header-toolbar')).toHaveClass('daily-page-header-controls');
  });

  it('carries the existing header/positioning classes so CSS stays unaffected', () => {
    const { container } = render(<PageHeader title="Daily" />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('page-header-copy', 'sticky-page-header', 'max-w-162');
    expect(container.querySelector('.page-header-copy-text')).toBeInTheDocument();
  });

  it('merges an extra className onto the header', () => {
    const { container } = render(<PageHeader title="Daily" className="daily-page" />);
    expect(container.querySelector('header')).toHaveClass('daily-page');
  });

});
