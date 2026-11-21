import type { DocumentMark, DocumentNode } from '../contracts/document';

// Mirrors api/src/services/document/schema.ts. Tiptap adds attributes the
// server does not accept (a link's title, alignment), so they are dropped here.
const NODE_ATTRS: Record<string, readonly string[]> = {
  doc: [], paragraph: [], heading: ['level'], bulletList: [], orderedList: ['start', 'type'], listItem: [],
  blockquote: [], codeBlock: ['language'], horizontalRule: [], text: [], hardBreak: [], taskReference: ['taskId', 'blockId'],
};
const MARK_ATTRS: Record<DocumentMark['type'], readonly string[]> = {
  bold: [], italic: [], strike: [], code: [], link: ['href', 'target', 'rel', 'class'],
};

const LANGUAGE_RE = /^[A-Za-z0-9_+#.-]{1,32}$/;
const MAX_HREF_LENGTH = 2048;
const ORDERED_TYPES = new Set(['1', 'a', 'A', 'i', 'I']);

export const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function isSafeHref(href: unknown): href is string {
  if (typeof href !== 'string' || href.length === 0 || href.length > MAX_HREF_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(href) || href.trim() !== href) return false;
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

function sanitizeNodeAttrs(type: string, raw: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const attrs = pick(raw, NODE_ATTRS[type] ?? []);
  if (!attrs) return undefined;
  if (type === 'codeBlock' && attrs.language !== undefined && attrs.language !== null) {
    if (typeof attrs.language !== 'string' || !LANGUAGE_RE.test(attrs.language)) {
      delete attrs.language;
    }
  }
  if (type === 'orderedList') {
    if (attrs.start !== undefined) {
      const n = Number(attrs.start);
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) delete attrs.start;
      else attrs.start = n;
    }
    if (attrs.type !== undefined && attrs.type !== null && (typeof attrs.type !== 'string' || !ORDERED_TYPES.has(attrs.type))) {
      delete attrs.type;
    }
  }
  if (type === 'heading') {
    const level = Number(attrs.level);
    attrs.level = level === 1 || level === 2 || level === 3 ? level : 1;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
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
  const attrs = sanitizeNodeAttrs(node.type, node.attrs);
  if (attrs) out.attrs = attrs;
  if (node.text !== undefined) out.text = node.text;
  const marks = cleanMarks(node.marks);
  if (marks) out.marks = marks;
  if (node.content) out.content = node.content.map(toServerContent);
  return out;
}

export function hasUnsupportedNodes(node: DocumentNode): boolean {
  if (!(node.type in NODE_ATTRS)) return true;
  if (node.type === 'heading' && ![1, 2, 3].includes(Number(node.attrs?.level))) return true;
  if ((node.marks ?? []).some((mark) => !(mark.type in MARK_ATTRS))) return true;
  return (node.content ?? []).some(hasUnsupportedNodes);
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

function block(node: DocumentNode, prefix = '', titles?: ReadonlyMap<string, string>): string {
  const children = node.content ?? [];
  switch (node.type) {
    case 'heading': return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(children)}`;
    case 'paragraph': return inline(children);
    case 'blockquote': return children.map((child) => block(child, '', titles)).join('\n\n').split('\n').map((line) => `> ${line}`).join('\n');
    case 'taskReference': return `- [ ] ${titles?.get(String(node.attrs?.taskId)) ?? ''}`.trimEnd();
    case 'codeBlock': return `\`\`\`${String(node.attrs?.language ?? '')}\n${inline(children)}\n\`\`\``;
    case 'horizontalRule': return '---';
    case 'bulletList':
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return children.map((item, index) => {
        const marker = node.type === 'bulletList' ? '- ' : `${start + index}. `;
        const body = (item.content ?? []).map((child) => block(child, `${prefix}  `, titles)).join('\n');
        return `${prefix}${marker}${body}`;
      }).join('\n');
    }
    default: return inline(children);
  }
}

/** A readable copy of a draft for the "Download draft" escape hatch. */
export function toMarkdown(doc: DocumentNode, titles?: ReadonlyMap<string, string>): string {
  return `${(doc.content ?? []).map((node) => block(node, '', titles)).join('\n\n')}\n`;
}

/** Every task id embedded in the text, once each. */
export function referencedTaskIds(doc: DocumentNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: DocumentNode) => {
    if (node.type === 'taskReference' && typeof node.attrs?.taskId === 'string') ids.add(node.attrs.taskId);
    node.content?.forEach(visit);
  };
  visit(doc);
  return ids;
}
