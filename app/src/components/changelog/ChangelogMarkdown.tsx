import { Fragment } from 'react';
import type { ChangelogBlock, ChangelogDocument, ChangelogInlineNode } from '../../types/changelog';

const LINK_CLASS =
  'text-ink-light underline decoration-border underline-offset-2 hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors break-words';

const HEADING_LINK_CLASS =
  'text-ink underline decoration-dot underline-offset-4 hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors';

function isExternalHref(href: string): boolean {
  return href.startsWith('https://') || href.startsWith('http://');
}

function renderInlineNodes(nodes: ChangelogInlineNode[], linkClassName = LINK_CLASS) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.value}</Fragment>;
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
          <code key={index} className="rounded-[4px] bg-dot/40 px-1 py-0.5 text-[13px] font-inherit text-ink">
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            className={linkClassName}
            {...(isExternalHref(node.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInlineNodes(node.children, linkClassName)}
          </a>
        );
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
            className="m-0 mb-2 mt-6 first:mt-0 text-[11px] leading-6 font-medium tracking-[0.1em] uppercase text-ink-light"
          >
            {renderInlineNodes(block.children)}
          </h3>
        );
      case 'paragraph':
        return (
          <p key={index} className="m-0 mb-4 last:mb-0 text-[14px] leading-6 text-ink min-w-0 break-words">
            {renderInlineNodes(block.children)}
          </p>
        );
      case 'list': {
        if (block.ordered) {
          return (
            <ol key={index} className="m-0 mb-6 last:mb-0 list-decimal pl-5 space-y-2 text-[14px] leading-6 text-ink">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="min-w-0 break-words pl-1">
                  {renderInlineNodes(item)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul key={index} className="m-0 mb-6 last:mb-0 list-none p-0 space-y-2">
            {block.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                className="relative pl-5 text-[14px] leading-6 text-ink min-w-0 break-words before:content-['•'] before:absolute before:left-1 before:text-ink-light"
              >
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
    <div className="space-y-12">
      {document.intro.length > 0 && <div>{renderBlocks(document.intro)}</div>}
      {document.sections.map((section, index) => {
        const { titleNodes, date } = splitTrailingDate(section.heading);
        return (
          <section key={index} className="min-w-0">
            <h2 className="m-0 mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2 text-[16px] leading-6 font-semibold text-ink">
              <span className="min-w-0 break-words">{renderInlineNodes(titleNodes, HEADING_LINK_CLASS)}</span>
              {date && (
                <time dateTime={date} className="shrink-0 text-[12px] leading-6 font-normal text-ink-light">
                  {date}
                </time>
              )}
            </h2>
            {renderBlocks(section.blocks)}
          </section>
        );
      })}
    </div>
  );
}
