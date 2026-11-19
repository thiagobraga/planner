import { describe, expect, it } from 'vitest';
import { hasUnsupportedNodes, toMarkdown, toServerContent } from './documentContent';
import type { DocumentNode } from '../contracts/document';

const text = (value: string, marks?: DocumentNode['marks']): DocumentNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });

describe('toServerContent', () => {
  it('keeps allowlisted attributes and drops the ones the server would reject', () => {
    const doc: DocumentNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, id: 'x' }, content: [text('Plan')] },
        { type: 'paragraph', attrs: { textAlign: null }, content: [text('site', [{ type: 'link', attrs: { href: 'https://a.dev', target: '_blank', rel: 'noopener', class: null, title: null } }])] },
      ],
    };
    expect(toServerContent(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
        { type: 'paragraph', content: [text('site', [{ type: 'link', attrs: { href: 'https://a.dev', target: '_blank', rel: 'noopener', class: null } }])] },
      ],
    });
  });

  it('turns a link with an unsafe protocol into plain text', () => {
    const doc: DocumentNode = { type: 'doc', content: [{ type: 'paragraph', content: [text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'bold' }])] }] };
    expect(toServerContent(doc).content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
  });
});

describe('hasUnsupportedNodes', () => {
  it('flags nodes this editor cannot render so it never silently drops them', () => {
    expect(hasUnsupportedNodes({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false);
    expect(hasUnsupportedNodes({ type: 'doc', content: [{ type: 'taskReference', attrs: { taskId: 'a', blockId: 'b' } }] })).toBe(true);
  });
});

describe('toMarkdown', () => {
  it('renders headings, lists, marks and code for a readable draft download', () => {
    const doc: DocumentNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
        { type: 'paragraph', content: [text('bold', [{ type: 'bold' }]), text(' and '), text('link', [{ type: 'link', attrs: { href: 'https://a.dev' } }])] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('one')] }] }] },
        { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('first')] }] }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [text('quote')] }] },
        { type: 'codeBlock', content: [text('let a = 1;')] },
        { type: 'horizontalRule' },
      ],
    };
    expect(toMarkdown(doc)).toBe('# Title\n\n**bold** and [link](https://a.dev)\n\n- one\n\n1. first\n\n> quote\n\n```\nlet a = 1;\n```\n\n---\n');
  });
});
