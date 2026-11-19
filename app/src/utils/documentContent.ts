import type { DocumentMark, DocumentNode } from '../contracts/document';

// Mirrors api/src/services/document/schema.ts. Tiptap adds attributes the
// server does not accept (a link's title, alignment), so they are dropped here.
const NODE_ATTRS: Record<string, readonly string[]> = {
  doc: [], paragraph: [], heading: ['level'], bulletList: [], orderedList: ['start', 'type'], listItem: [],
  blockquote: [], codeBlock: ['language'], horizontalRule: [], text: [], hardBreak: [],
};
const MARK_ATTRS: Record<DocumentMark['type'], readonly string[]> = {
  bold: [], italic: [], strike: [], code: [], link: ['href', 'target', 'rel', 'class'],
};

export const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function isSafeHref(href: unknown): href is string {
  if (typeof href !== 'string' || href.trim() !== href || href.length === 0) return false;
  try {
    return LINK_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function pick(attrs: Record<string, unknown> | undefined, keys: readonly string[]) {
  if (!attrs) return undefined;
  const kept = Object.fromEntries(keys.filter((key) => attrs[key] !== undefined).map((key) => [key, attrs[key]]));
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function cleanMarks(marks: DocumentMark[] | undefined): DocumentMark[] | undefined {
  const kept = (marks ?? [])
    .filter((mark) => MARK_ATTRS[mark.type] && (mark.type !== 'link' || isSafeHref(mark.attrs?.href)))
    .map((mark) => {
      const attrs = pick(mark.attrs, MARK_ATTRS[mark.type]);
      return attrs ? { type: mark.type, attrs } : { type: mark.type };
    });
  return kept.length > 0 ? kept : undefined;
}

/** Editor JSON reduced to exactly what PUT /tasks/:id/document accepts. */
export function toServerContent(node: DocumentNode): DocumentNode {
  const out: DocumentNode = { type: node.type };
  const attrs = pick(node.attrs, NODE_ATTRS[node.type] ?? []);
  if (attrs) out.attrs = attrs;
  if (node.text !== undefined) out.text = node.text;
  const marks = cleanMarks(node.marks);
  if (marks) out.marks = marks;
  if (node.content) out.content = node.content.map(toServerContent);
  return out;
}

export function hasUnsupportedNodes(node: DocumentNode): boolean {
  return !(node.type in NODE_ATTRS) || (node.content ?? []).some(hasUnsupportedNodes);
}

function inline(nodes: DocumentNode[] = []): string {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return '  \n';
    let value = node.text ?? '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') value = `**${value}**`;
      else if (mark.type === 'italic') value = `*${value}*`;
      else if (mark.type === 'strike') value = `~~${value}~~`;
      else if (mark.type === 'code') value = `\`${value}\``;
      else if (mark.type === 'link') value = `[${value}](${String(mark.attrs?.href ?? '')})`;
    }
    return value;
  }).join('');
}

function block(node: DocumentNode, prefix = ''): string {
  const children = node.content ?? [];
  switch (node.type) {
    case 'heading': return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(children)}`;
    case 'paragraph': return inline(children);
    case 'blockquote': return children.map((child) => block(child)).join('\n\n').split('\n').map((line) => `> ${line}`).join('\n');
    case 'codeBlock': return `\`\`\`${String(node.attrs?.language ?? '')}\n${inline(children)}\n\`\`\``;
    case 'horizontalRule': return '---';
    case 'bulletList':
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return children.map((item, index) => {
        const marker = node.type === 'bulletList' ? '- ' : `${start + index}. `;
        const body = (item.content ?? []).map((child) => block(child, `${prefix}  `)).join('\n');
        return `${prefix}${marker}${body}`;
      }).join('\n');
    }
    default: return inline(children);
  }
}

/** A readable copy of a draft for the "Download draft" escape hatch. */
export function toMarkdown(doc: DocumentNode): string {
  return `${(doc.content ?? []).map((node) => block(node)).join('\n\n')}\n`;
}
