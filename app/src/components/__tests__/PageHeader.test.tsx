import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PageHeader } from '../PageHeader';

vi.mock('../../api/client', () => ({
  fetchPreferences: vi.fn(async () => ({ background: 'beige' })),
  apiUpdatePreferences: vi.fn(),
}));

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

  it('keeps actions on the title row, after the title', () => {
    const { container } = render(<PageHeader title="Daily" actions={<div className="page-toolbar"><button>Today</button></div>} />);
    const row = container.querySelector('.page-header-row');
    expect(row?.firstElementChild).toHaveTextContent('Daily');
    expect(row).toContainElement(screen.getByRole('button', { name: 'Today' }));
    expect(container.querySelector('.page-header-copy-text')).not.toBeInTheDocument();
  });

  it('carries the existing header/positioning classes so CSS stays unaffected', () => {
    const { container } = render(<PageHeader title="Daily" />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('page-header-copy', 'sticky-page-header');
    expect(header?.className).not.toMatch(/max-w-/);
    expect(container.querySelector('.page-header-copy-text')).toBeInTheDocument();
  });

  it('merges an extra className onto the header', () => {
    const { container } = render(<PageHeader title="Daily" className="daily-page" />);
    expect(container.querySelector('header')).toHaveClass('daily-page');
  });

});
