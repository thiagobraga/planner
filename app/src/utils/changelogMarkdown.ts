import type { ChangelogBlock, ChangelogDocument, ChangelogInlineNode, ChangelogSection } from '../types/changelog';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;

const ENTITY_RE = /^&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/;

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

function pushText(nodes: ChangelogInlineNode[], value: string): void {
  if (!value) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === 'text') {
    last.value += value;
  } else {
    nodes.push({ type: 'text', value });
  }
}

export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || CONTROL_CHAR_RE.test(trimmed)) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function findClosingLinkUrl(text: string, openParenIndex: number): number {
  let depth = 1;
  for (let i = openParenIndex + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      i += 1;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findDelimitedEnd(text: string, start: number, delimiter: string): number {
  for (let i = start; i <= text.length - delimiter.length; i += 1) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i += 1;
      continue;
    }
    if (text.startsWith(delimiter, i)) {
      return i;
    }
  }
  return -1;
}

export function parseInlineMarkdown(text: string): ChangelogInlineNode[] {
  const nodes: ChangelogInlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\' && i + 1 < text.length) {
      pushText(nodes, text[i + 1]);
      i += 2;
      continue;
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        nodes.push({ type: 'code', value: decodeHtmlEntities(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > i + 1 && text[closeBracket + 1] === '(') {
        const closeParen = findClosingLinkUrl(text, closeBracket + 1);
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket);
          const href = decodeHtmlEntities(text.slice(closeBracket + 2, closeParen).trim());
          const children = parseInlineMarkdown(label);
          if (isSafeHref(href)) {
            nodes.push({ type: 'link', href, children });
          } else {
            nodes.push(...children);
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const delimiter = text.slice(i, i + 2);
      const end = findDelimitedEnd(text, i + 2, delimiter);
      if (end > i + 2) {
        nodes.push({ type: 'bold', children: parseInlineMarkdown(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === '*') {
      const end = findDelimitedEnd(text, i + 1, '*');
      if (end > i + 1) {
        nodes.push({ type: 'italic', children: parseInlineMarkdown(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '_' && (i === 0 || /\s|[([{"']/.test(text[i - 1]))) {
      const end = findDelimitedEnd(text, i + 1, '_');
      if (end > i + 1 && (end + 1 === text.length || /\s|[.,;:!?)}\]"]/.test(text[end + 1]))) {
        nodes.push({ type: 'italic', children: parseInlineMarkdown(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '&') {
      const entityMatch = ENTITY_RE.exec(text.slice(i));
      if (entityMatch) {
        pushText(nodes, decodeHtmlEntities(entityMatch[0]));
        i += entityMatch[0].length;
        continue;
      }
    }

    pushText(nodes, ch);
    i += 1;
  }

  return nodes;
}

export function parseChangelogMarkdown(markdown: string): ChangelogDocument {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  if (!normalized.trim()) {
    return { title: null, intro: [], sections: [] };
  }

  const lines = normalized.split('\n');
  let title: string | null = null;
  const intro: ChangelogBlock[] = [];
  const sections: ChangelogSection[] = [];
  let currentSection: ChangelogSection | null = null;
  let paragraphLines: string[] = [];
  let activeList: { ordered: boolean; items: string[] } | null = null;

  const targetBlocks = () => (currentSection ? currentSection.blocks : intro);

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    targetBlocks().push({
      type: 'paragraph',
      children: parseInlineMarkdown(paragraphLines.join(' ').trim()),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!activeList || activeList.items.length === 0) {
      activeList = null;
      return;
    }
    targetBlocks().push({
      type: 'list',
      ordered: activeList.ordered,
      items: activeList.items.map((item) => parseInlineMarkdown(item)),
    });
    activeList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const h1Match = /^#\s+(.+)$/.exec(trimmed);
    if (h1Match && title === null && sections.length === 0 && intro.length === 0 && paragraphLines.length === 0) {
      title = decodeHtmlEntities(h1Match[1].trim());
      continue;
    }

    const h2Match = /^(?:##|#)\s+(.+)$/.exec(trimmed);
    if (h2Match) {
      flushParagraph();
      flushList();
      currentSection = {
        heading: parseInlineMarkdown(h2Match[1].trim()),
        blocks: [],
      };
      sections.push(currentSection);
      continue;
    }

    const h3Match = /^#{3,6}\s+(.+)$/.exec(trimmed);
    if (h3Match) {
      flushParagraph();
      flushList();
      targetBlocks().push({
        type: 'heading',
        level: 3,
        children: parseInlineMarkdown(h3Match[1].trim()),
      });
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      flushParagraph();
      if (activeList && activeList.ordered) flushList();
      if (!activeList) activeList = { ordered: false, items: [] };
      activeList.items.push(ulMatch[1].trim());
      continue;
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      flushParagraph();
      if (activeList && !activeList.ordered) flushList();
      if (!activeList) activeList = { ordered: true, items: [] };
      activeList.items.push(olMatch[1].trim());
      continue;
    }

    if (activeList && /^\s{2,}\S/.test(line) && activeList.items.length > 0) {
      activeList.items[activeList.items.length - 1] += ` ${trimmed}`;
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return { title, intro, sections };
}
