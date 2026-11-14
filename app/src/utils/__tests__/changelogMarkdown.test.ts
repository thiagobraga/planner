import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_MARKDOWN } from '../changelog';
import { isSafeHref, parseChangelogMarkdown, parseInlineMarkdown } from '../changelogMarkdown';

const rootChangelog = readFileSync(resolve(process.cwd(), '../CHANGELOG.md'), 'utf-8');

describe('changelog bundling', () => {
  it('bundles the root CHANGELOG.md without maintaining a separate copy', () => {
    expect(CHANGELOG_MARKDOWN).toBe(rootChangelog);
    expect(CHANGELOG_MARKDOWN).toContain('0.19.2');
    expect(CHANGELOG_MARKDOWN).toContain('0.19.1');
  });
});

describe('isSafeHref', () => {
  it('allows https, http, root-relative, and fragment links', () => {
    expect(isSafeHref('https://github.com/thiagobraga/planner/commit/abc123')).toBe(true);
    expect(isSafeHref('http://example.com/path')).toBe(true);
    expect(isSafeHref('/changelog#0.19.2')).toBe(true);
    expect(isSafeHref('#v0.19.2')).toBe(true);
  });

  it('rejects javascript, data, vbscript, file, protocol-relative, and control-char URLs', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeHref('  java\tscript:alert(1)  ')).toBe(false);
    expect(isSafeHref('java\u0000script:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHref('file:///etc/passwd')).toBe(false);
    expect(isSafeHref('//evil.example.com/phish')).toBe(false);
    expect(isSafeHref('')).toBe(false);
  });
});

describe('parseInlineMarkdown', () => {
  it('parses bold, italic, inline code, links, and HTML entities', () => {
    const nodes = parseInlineMarkdown(
      '**tasks:** preserve `/daily/&lt;view&gt;` &amp; *italic* ([f03fe7f](https://github.com/thiagobraga/planner/commit/f03fe7f))',
    );
    expect(nodes).toEqual([
      { type: 'bold', children: [{ type: 'text', value: 'tasks:' }] },
      { type: 'text', value: ' preserve ' },
      { type: 'code', value: '/daily/<view>' },
      { type: 'text', value: ' & ' },
      { type: 'italic', children: [{ type: 'text', value: 'italic' }] },
      { type: 'text', value: ' (' },
      {
        type: 'link',
        href: 'https://github.com/thiagobraga/planner/commit/f03fe7f',
        children: [{ type: 'text', value: 'f03fe7f' }],
      },
      { type: 'text', value: ')' },
    ]);
  });

  it('downgrades unsafe links to plain text instead of link nodes', () => {
    const nodes = parseInlineMarkdown('[click me](javascript:alert(1))');
    expect(nodes).toEqual([{ type: 'text', value: 'click me' }]);
  });
});

describe('parseChangelogMarkdown', () => {
  it('returns an empty document for empty or whitespace-only content', () => {
    expect(parseChangelogMarkdown('')).toEqual({ title: null, intro: [], sections: [] });
    expect(parseChangelogMarkdown('   \n\n\t  ')).toEqual({ title: null, intro: [], sections: [] });
  });

  it('preserves release order, release links, dates, categories, duplicate entries, and paragraphs', () => {
    const sample = [
      '# Changelog',
      '',
      '## [0.19.1](https://github.com/thiagobraga/planner/compare/v0.19.0...v0.19.1) (2026-11-14)',
      '',
      '### Fixed',
      '',
      '* **nav:** make the inbox tab its own drop target ([2671c1d](https://github.com/thiagobraga/planner/commit/2671c1d))',
      '* **nav:** make the inbox tab its own drop target ([19580ba](https://github.com/thiagobraga/planner/commit/19580ba))',
      '',
      '## [0.19.0](https://github.com/thiagobraga/planner/compare/v0.18.0...v0.19.0) (2026-11-14)',
      '',
      '### Added',
      '',
      '* **app:** rename to BulletPlanner ([207897f](https://github.com/thiagobraga/planner/commit/207897f))',
      '',
      '## Changelog',
      '',
      'Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)',
      'and Semantic Versioning.',
    ].join('\n');

    const doc = parseChangelogMarkdown(sample);
    expect(doc.title).toBe('Changelog');
    expect(doc.sections).toHaveLength(3);
    expect(doc.sections[0].heading).toEqual([
      {
        type: 'link',
        href: 'https://github.com/thiagobraga/planner/compare/v0.19.0...v0.19.1',
        children: [{ type: 'text', value: '0.19.1' }],
      },
      { type: 'text', value: ' (2026-11-14)' },
    ]);
    expect(doc.sections[0].blocks).toHaveLength(2);
    expect(doc.sections[0].blocks[0]).toEqual({
      type: 'heading',
      level: 3,
      children: [{ type: 'text', value: 'Fixed' }],
    });
    const list = doc.sections[0].blocks[1];
    expect(list.type).toBe('list');
    if (list.type === 'list') {
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(2);
    }
    expect(doc.sections[2].blocks[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Follows ' },
        {
          type: 'link',
          href: 'https://keepachangelog.com/en/1.1.0/',
          children: [{ type: 'text', value: 'Keep a Changelog' }],
        },
        { type: 'text', value: ' and Semantic Versioning.' },
      ],
    });
  });

  it('parses the entire root CHANGELOG.md in order without losing releases', () => {
    const doc = parseChangelogMarkdown(CHANGELOG_MARKDOWN);
    expect(doc.title).toBe('Changelog');
    expect(doc.sections.length).toBeGreaterThan(10);
    const firstHeadingText = doc.sections[0].heading
      .map((n) => (n.type === 'link' ? n.children.map((c) => ('value' in c ? c.value : '')).join('') : 'value' in n ? n.value : ''))
      .join('');
    expect(firstHeadingText).toContain('0.19.2');
  });
});
