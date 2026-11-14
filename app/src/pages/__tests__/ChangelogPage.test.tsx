import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_MARKDOWN } from '../../utils/changelog';
import { parseChangelogMarkdown } from '../../utils/changelogMarkdown';
import { ChangelogPage } from '../ChangelogPage';

function renderChangelog(markdown?: string) {
  return render(
    <MemoryRouter>
      <ChangelogPage markdown={markdown} />
    </MemoryRouter>,
  );
}

describe('ChangelogPage', () => {
  it('renders bundled releases without a subtitle and uses external-link icons instead of underlines', () => {
    const doc = parseChangelogMarkdown(CHANGELOG_MARKDOWN);
    const firstLink = doc.sections[0]?.heading.find((n) => n.type === 'link');
    const secondLink = doc.sections[1]?.heading.find((n) => n.type === 'link');
    if (firstLink?.type !== 'link' || secondLink?.type !== 'link') {
      throw new Error('Expected top two bundled changelog sections to have release links');
    }
    const firstVersion = firstLink.children.map((c) => ('value' in c ? c.value : '')).join('');
    const secondVersion = secondLink.children.map((c) => ('value' in c ? c.value : '')).join('');

    const { container } = renderChangelog();
    expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument();
    expect(container.querySelector('.page-header-subtitle')).not.toBeInTheDocument();

    const releaseHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(releaseHeadings).toHaveLength(doc.sections.length);
    expect(releaseHeadings[0]).toHaveTextContent(firstVersion);
    expect(releaseHeadings[0]).toHaveTextContent(/\d{4}-\d{2}-\d{2}/);
    expect(releaseHeadings[1]).toHaveTextContent(secondVersion);

    const compareLink = screen.getByRole('link', { name: firstVersion });
    expect(compareLink).toHaveAttribute('href', firstLink.href);
    expect(compareLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(compareLink).toHaveAttribute('target', '_blank');
    expect(compareLink).toHaveClass('no-underline');
    expect(compareLink).not.toHaveClass('underline');
    const externalIcon = compareLink.querySelector('svg');
    expect(externalIcon).toBeInTheDocument();
    expect(externalIcon).toHaveAttribute('aria-hidden', 'true');
  });

  it('formats commit SHA links without parens in 10px monospace and preserves duplicate entries', () => {
    renderChangelog([
      '# Changelog',
      '',
      '## [0.19.1](https://github.com/thiagobraga/planner/compare/v0.19.0...v0.19.1) (2026-11-14)',
      '',
      '### Fixed',
      '',
      '* **nav:** make the inbox tab its own drop target on phones ([2671c1d](https://github.com/thiagobraga/planner/commit/2671c1d))',
      '* **nav:** make the inbox tab its own drop target on phones ([19580ba](https://github.com/thiagobraga/planner/commit/19580ba))',
    ].join('\n'));

    const commitLink = screen.getByRole('link', { name: '2671c1d' });
    expect(commitLink).toHaveClass('font-mono', 'text-[10px]', 'ml-2');
    const commitRow = commitLink.closest('li')!;
    expect(commitRow.textContent).not.toContain('(2671c1d)');

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
