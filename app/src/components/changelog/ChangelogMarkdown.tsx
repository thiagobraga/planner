import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ChangelogBlock, ChangelogDocument, ChangelogInlineNode } from '../../types/changelog';

const LINK_CLASS =
  'group text-ink-light no-underline hover:text-accent focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors break-words';

const HEADING_LINK_CLASS =
  'group inline-flex items-center gap-1.5 text-ink no-underline hover:text-accent focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors';

function isExternalHref(href: string): boolean {
  return href.startsWith('https://') || href.startsWith('http://');
}

function getInlineText(nodes: ChangelogInlineNode[]): string {
  let out = '';
  for (const node of nodes) {
    out += node.type === 'text' || node.type === 'code' ? node.value : getInlineText(node.children);
  }
  return out;
}

function isCommitShaLink(node: Extract<ChangelogInlineNode, { type: 'link' }>): boolean {
  return /\/commit\/[0-9a-f]{7,40}/i.test(node.href) && /^[0-9a-f]{7,40}$/i.test(getInlineText(node.children).trim());
}

function renderInlineNodes(nodes: ChangelogInlineNode[], linkClassName = LINK_CLASS) {
  return nodes.map((node, index) => {
    const prev = nodes[index - 1];
    const next = nodes[index + 1];

    switch (node.type) {
      case 'text': {
        let value = node.value;
        if (next?.type === 'link' && isCommitShaLink(next)) {
          value = value.replace(/\s*\($/, '');
        }
        if (prev?.type === 'link' && isCommitShaLink(prev)) {
          value = value.replace(/^\)/, '');
        }
        return value ? <Fragment key={index}>{value}</Fragment> : null;
      }
      case 'bold':
        return (
          <strong key={index} className="font-semibold text-ink">
            {renderInlineNodes(node.children, linkClassName)}
          </strong>
        );
      case 'italic':
        return (
          <em key={index} className="italic">
            {renderInlineNodes(node.children, linkClassName)}
          </em>
        );
      case 'code':
        return (
          <code key={index} className="rounded-[4px] bg-dot/40 px-1 py-0 text-[13px] font-inherit text-ink">
            {node.value}
          </code>
        );
      case 'link': {
        const external = isExternalHref(node.href);
        const commitSha = linkClassName !== HEADING_LINK_CLASS && isCommitShaLink(node);
        const keepInlineTogether =
          linkClassName === HEADING_LINK_CLASS || commitSha || getInlineText(node.children).length <= 24;
        const linkClass =
          linkClassName === HEADING_LINK_CLASS || !keepInlineTogether
            ? linkClassName
            : commitSha
              ? `${linkClassName} ml-2 inline-flex items-center gap-0.5 whitespace-nowrap font-mono text-[10px] leading-none`
              : `${linkClassName} inline-flex items-center gap-1 whitespace-nowrap leading-none`;
        return (
          <a
            key={index}
            href={node.href}
            className={linkClass}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInlineNodes(node.children, linkClassName)}
            {external && (
              <ExternalLink
                aria-hidden="true"
                className={
                  linkClassName === HEADING_LINK_CLASS
                    ? 'h-3.5 w-3.5 shrink-0 -translate-y-[0.5px] text-ink-light transition-colors group-hover:text-accent'
                    : commitSha
                      ? 'h-2.5 w-2.5 shrink-0 -translate-y-px text-ink-light transition-colors group-hover:text-accent'
                      : keepInlineTogether
                        ? 'h-3 w-3 shrink-0 -translate-y-px text-ink-light transition-colors group-hover:text-accent'
                        : 'ml-1 inline-block h-3 w-3 shrink-0 align-[-0.1em] text-ink-light transition-colors group-hover:text-accent'
                }
              />
            )}
          </a>
        );
      }
    }
  });
}

function splitTrailingDate(nodes: ChangelogInlineNode[]): {
  titleNodes: ChangelogInlineNode[];
  date: string | null;
} {
  if (nodes.length === 0) return { titleNodes: nodes, date: null };
  const last = nodes[nodes.length - 1];
  if (last.type !== 'text') return { titleNodes: nodes, date: null };

  const match = /^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/.exec(last.value);
  if (!match) return { titleNodes: nodes, date: null };

  const prefix = match[1];
  const date = match[2];
  const titleNodes = prefix
    ? [...nodes.slice(0, -1), { type: 'text' as const, value: prefix }]
    : nodes.slice(0, -1);

  return { titleNodes, date };
}

function renderBlocks(blocks: ChangelogBlock[]) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'heading':
        return (
          <h3
            key={index}
            className="m-0 mb-0 mt-6 first:mt-0 text-[11px] leading-6 font-medium tracking-[0.1em] uppercase text-ink-light"
          >
            {renderInlineNodes(block.children)}
          </h3>
        );
      case 'paragraph':
        return (
          <p key={index} className="m-0 mb-6 last:mb-0 text-[14px] leading-6 text-ink min-w-0 break-words">
            {renderInlineNodes(block.children)}
          </p>
        );
      case 'list': {
        if (block.ordered) {
          return (
            <ol key={index} className="m-0 mb-6 last:mb-0 list-decimal pl-5 space-y-0 text-[14px] leading-6 text-ink">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="min-w-0 break-words pl-1">
                  {renderInlineNodes(item)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul key={index} className="m-0 mb-6 last:mb-0 list-none p-0 space-y-0">
            {block.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                className="relative pl-6 text-[14px] leading-6 text-ink min-w-0 break-words"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 flex h-6 w-6 items-center justify-center"
                >
                  <span className="block h-[3px] w-[3px] rounded-full bg-ink-light" />
                </span>
                {renderInlineNodes(item)}
              </li>
            ))}
          </ul>
        );
      }
    }
  });
}

export function ChangelogMarkdown({ document }: { document: ChangelogDocument }) {
  return (
    <div>
      {document.intro.length > 0 && <div className="mb-12 last:mb-0">{renderBlocks(document.intro)}</div>}
      {document.sections.map((section, index) => {
        const { titleNodes, date } = splitTrailingDate(section.heading);
        return (
          <section key={index} className="group/section min-w-0">
            <h2 className="sticky top-6 z-[9] m-0 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-0 bg-(--planner-page-bg) pb-0 text-[16px] leading-6 font-semibold text-ink after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:-translate-y-1/2 after:h-px after:bg-border">
              <span className="flex min-w-0 items-center break-words leading-6">{renderInlineNodes(titleNodes, HEADING_LINK_CLASS)}</span>
              {date && (
                <time dateTime={date} className="shrink-0 text-[12px] leading-6 font-normal text-ink-light">
                  {date}
                </time>
              )}
            </h2>
            <div className="pt-6 pb-12 group-last/section:pb-0">{renderBlocks(section.blocks)}</div>
          </section>
        );
      })}
    </div>
  );
}
