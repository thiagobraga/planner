import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ChangelogPage } from '../ChangelogPage';

vi.mock('../../utils/version', () => ({ APP_VERSION: '0.19.2' }));

function renderChangelog(markdown?: string) {
  return render(
    <MemoryRouter>
      <ChangelogPage markdown={markdown} />
    </MemoryRouter>,
  );
}

describe('ChangelogPage', () => {
  it('renders bundled releases in order with headings, dates, categories, entries, and links', () => {
    renderChangelog();
    expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument();

    const releaseHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(releaseHeadings.length).toBeGreaterThan(10);
    expect(releaseHeadings[0]).toHaveTextContent('0.19.2');
    expect(releaseHeadings[0]).toHaveTextContent('2026-11-14');
    expect(releaseHeadings[1]).toHaveTextContent('0.19.1');

    const compareLink = screen.getByRole('link', { name: '0.19.2' });
    expect(compareLink).toHaveAttribute('href', 'https://github.com/thiagobraga/planner/compare/v0.19.1...v0.19.2');
    expect(compareLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(compareLink).toHaveAttribute('target', '_blank');

    // Duplicate entries in 0.19.1 must both be preserved.
    const dupEntries = screen.getAllByText(/make the inbox tab its own drop target on phones/);
    expect(dupEntries).toHaveLength(2);
  });

  it('renders an empty state when the changelog is empty', () => {
    renderChangelog('   \n  ');
    expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument();
    expect(screen.getByText('No changelog entries yet.')).toBeInTheDocument();
  });

  it('renders raw HTML safely as text and strips unsafe links', () => {
    const { container } = renderChangelog([
      '# Changelog',
      '',
      '## [0.1.0](javascript:alert(1)) (2026-01-01)',
      '',
      '### Security',
      '',
      '* <script>window.__xss = true</script><img src=x onerror="alert(1)"> [bad](data:text/html,boom) **ok:** /daily/&lt;view&gt;',
    ].join('\n'));

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: '0.1.0' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument();
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
    expect(screen.getByText(/\/daily\/<view>/)).toBeInTheDocument();
  });

  it('supports ordered lists, italic text, inline code, and plain section headings', () => {
    renderChangelog([
      '# Changelog',
      '',
      '## Notes',
      '',
      'Read *carefully* with `npm run build` before deploy.',
      '',
      '1. First step',
      '2. Second step',
    ].join('\n'));

    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('carefully').tagName).toBe('EM');
    expect(screen.getByText('npm run build').tagName).toBe('CODE');
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(screen.getByText('First step')).toBeInTheDocument();
    expect(screen.getByText('Second step')).toBeInTheDocument();
  });
});
