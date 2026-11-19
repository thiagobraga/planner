import type { DocumentNode } from "../../contracts/document.js";

// tasks.description is the plain-text projection of a document: what search,
// list rows, exports and older clients read. Blocks are separated by a blank
// line and hard breaks are single newlines, so a seeded plain description
// derives back to exactly the same text.

const BLOCK_SEPARATOR = "\n\n";

function paragraphFrom(chunk: string): DocumentNode {
  const content: DocumentNode[] = [];
  chunk.split("\n").forEach((line, i) => {
    if (i > 0) content.push({ type: "hardBreak" });
    if (line.length > 0) content.push({ type: "text", text: line });
  });
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

/** The document a task starts from before its first rich save. */
export function seedDocument(description: string | null): DocumentNode {
  return { type: "doc", content: (description ?? "").split(BLOCK_SEPARATOR).map(paragraphFrom) };
}

function inlineText(node: DocumentNode): string {
  return (node.content ?? [])
    .map((child) => (child.type === "hardBreak" ? "\n" : child.text ?? ""))
    .join("");
}

function prefixLines(text: string, prefix: string): string {
  return text.split("\n").map((line) => prefix + line).join("\n");
}

function listText(list: DocumentNode, titles: Map<string, string>, indent: string): string {
  return (list.content ?? []).map((item) => {
    const [first, ...rest] = item.content ?? [];
    const head = (first ? inlineText(first) : "").replace(/\n/g, `\n${indent}  `);
    const lines = [`${indent}- ${head}`];
    for (const block of rest) {
      const nested = block.type === "bulletList" || block.type === "orderedList"
        ? listText(block, titles, `${indent}  `)
        : prefixLines(blockText(block, titles) ?? "", `${indent}  `);
      lines.push(nested);
    }
    return lines.join("\n");
  }).join("\n");
}

function blockText(node: DocumentNode, titles: Map<string, string>): string | null {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inlineText(node);
    case "codeBlock":
      return (node.content ?? []).map((child) => child.text ?? "").join("");
    case "bulletList":
    case "orderedList":
      return listText(node, titles, "");
    case "blockquote":
      return prefixLines(blocksText(node.content ?? [], titles), "> ");
    case "horizontalRule":
      return "---";
    case "taskReference":
      return titles.get(String(node.attrs?.taskId)) ?? null;
    default:
      return null;
  }
}

function blocksText(blocks: DocumentNode[], titles: Map<string, string>): string {
  return blocks
    .map((block) => blockText(block, titles))
    .filter((text): text is string => text !== null)
    .join(BLOCK_SEPARATOR);
}

/**
 * Derive the plain-text description. Task references render as the referenced
 * task's title when `titles` has it and are left out otherwise.
 */
export function documentToPlainText(doc: DocumentNode, titles: Map<string, string> = new Map()): string {
  return blocksText(doc.content ?? [], titles);
}

/** Every task id referenced anywhere in the document, once each. */
export function referencedTaskIds(doc: DocumentNode): string[] {
  const ids = new Set<string>();
  const visit = (node: DocumentNode) => {
    if (node.type === "taskReference" && typeof node.attrs?.taskId === "string") ids.add(node.attrs.taskId);
    node.content?.forEach(visit);
  };
  visit(doc);
  return [...ids];
}
