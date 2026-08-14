import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';

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

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Daily" subtitle="A phrase for today" />);
    expect(screen.getByText('A phrase for today')).toBeInTheDocument();
  });

  it('omits the subtitle paragraph when not provided', () => {
    const { container } = render(<PageHeader title="Daily" />);
    expect(container.querySelector('.page-header-subtitle')).not.toBeInTheDocument();
  });

  it('renders the toolbar slot', () => {
    render(<PageHeader title="Daily" toolbar={<button>Today</button>} />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
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

  it('merges toolbarClassName onto the page-header-toolbar div, not the header', () => {
    const { container } = render(
      <PageHeader title="Daily" toolbar={<span>controls</span>} toolbarClassName="inbox-page-header-controls" />,
    );
    const toolbar = container.querySelector('.page-header-toolbar');
    expect(toolbar).toHaveClass('inbox-page-header-controls');
    expect(container.querySelector('header')).not.toHaveClass('inbox-page-header-controls');
  });
});
