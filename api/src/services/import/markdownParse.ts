import type { DocumentMark, DocumentNode } from "../../contracts/document.js";
import type { ParsedMarkdown, ParsedTask } from "../../types/import.js";
import { isSafeHref } from "../document/schema.js";

// A bounded, line-based reader for the Markdown our specs use. Anything it does
// not model stays as literal text with a warning, never silently dropped.

const MAX_TITLE = 500;
const CHECK_RE = /^(\s*)[-*+]\s+\[( |x|X|~)\]\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```|~~~)\s*([A-Za-z0-9_+#.-]{0,32})\s*$/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const SECRET_RE = /\b(plnr_[A-Za-z0-9_]{16,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[abp]-[A-Za-z0-9-]{10,})\b|(password|secret|api[_-]?key)\s*[:=]\s*\S{6,}/i;

export interface ParseOptions {
  checklists?: "tasks" | "text";
  /** Levels of checklist nesting that may become tasks, counted from the first. */
  maxDepth?: number;
  /** Prefix for task keys, so two parses can share one document. */
  keyPrefix?: string;
}

const textNode = (text: string, marks?: DocumentMark[]): DocumentNode => (marks?.length ? { type: "text", text, marks } : { type: "text", text });

/** Inline marks: bold, italic, strike, code and links. */
export function parseInline(source: string, warnings: string[]): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  const re = /(\*\*|__)(.+?)\1|~~(.+?)~~|`([^`]+)`|!\[([^\]]*)\]\(([^)]*)\)|\[([^\]]+)\]\(([^)\s]+)\)|(\*|_)(?=\S)(.+?)(?<=\S)\9/g;
  let last = 0;
  for (const m of source.matchAll(re)) {
    if (m.index > last) nodes.push(textNode(source.slice(last, m.index)));
    if (m[2] !== undefined) nodes.push(textNode(m[2], [{ type: "bold" }]));
    else if (m[3] !== undefined) nodes.push(textNode(m[3], [{ type: "strike" }]));
    else if (m[4] !== undefined) nodes.push(textNode(m[4], [{ type: "code" }]));
    else if (m[6] !== undefined) {
      warnings.push(`Image kept as text: ${m[0]}`);
      nodes.push(textNode(m[0]));
    } else if (m[8] !== undefined) {
      if (isSafeHref(m[8])) nodes.push(textNode(m[7], [{ type: "link", attrs: { href: m[8] } }]));
      else {
        warnings.push(`Link without a safe URL kept as its text: ${m[7]}`);
        nodes.push(textNode(m[7]));
      }
    } else nodes.push(textNode(m[10], [{ type: "italic" }]));
    last = m.index + m[0].length;
  }
  if (last < source.length) nodes.push(textNode(source.slice(last)));
  return nodes.filter((node) => node.text !== "");
}

/** Plain title for a task: inline Markdown reduced to its text. */
function plainTitle(source: string): string {
  return parseInline(source, []).map((node) => node.text ?? "").join("").trim().slice(0, MAX_TITLE) || "Untitled";
}

const paragraph = (source: string, warnings: string[]): DocumentNode => {
  const content = parseInline(source, warnings);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

const indentOf = (raw: string) => raw.replace(/\t/g, "  ").length;

export function parseMarkdown(markdown: string, options: ParseOptions = {}): ParsedMarkdown {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocumentNode[] = [];
  const tasks: ParsedTask[] = [];
  const warnings: string[] = [];
  const asTasks = (options.checklists ?? "tasks") === "tasks";
  const maxDepth = options.maxDepth ?? 5;
  let taskSeq = 0;
  let para: string[] = [];
  let i = 0;

  if (SECRET_RE.test(markdown)) warnings.push("Possible secret or credential in the text; review before importing");

  const flush = () => {
    if (para.length) blocks.push(paragraph(para.join(" "), warnings));
    para = [];
  };

  // Checklist run: consecutive checklist lines (and their indented continuations) become a task tree.
  const readChecklist = () => {
    const stack: { indent: number; task: ParsedTask; depth: number }[] = [];
    while (i < lines.length) {
      const m = CHECK_RE.exec(lines[i]);
      if (!m) break;
      const indent = indentOf(m[1]);
      const task: ParsedTask = {
        key: `${options.keyPrefix ?? "t"}${++taskSeq}`,
        title: plainTitle(m[3]),
        state: m[2] === " " ? "open" : m[2] === "~" ? "doing" : "done",
        children: [],
      };
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      if (!parent) {
        tasks.push(task);
        blocks.push({ type: "taskReference", attrs: { key: task.key } });
        stack.push({ indent, task, depth: 1 });
      } else if (parent.depth >= maxDepth) {
        warnings.push(`Nested too deep to become a subtask, merged into its parent: ${task.title}`);
      } else {
        parent.task.children.push(task);
        stack.push({ indent, task, depth: parent.depth + 1 });
      }
      i++;
    }
  };

  // Ordinary list: items with nesting by indent; checklist lines inside stay prose when checklists are text.
  const readList = () => {
    const ordered = ORDERED_RE.test(lines[i]) && !BULLET_RE.test(lines[i]);
    const baseIndent = indentOf((ordered ? ORDERED_RE : BULLET_RE).exec(lines[i])![1]);
    const items: DocumentNode[] = [];
    while (i < lines.length) {
      const line = lines[i];
      const m = BULLET_RE.exec(line) ?? ORDERED_RE.exec(line);
      if (!m) break;
      if (asTasks && CHECK_RE.test(line)) break;
      const indent = indentOf(m[1]);
      if (indent < baseIndent) break;
      if (indent > baseIndent && items.length) {
        const nested = readList();
        const last = items[items.length - 1];
        last.content = [...(last.content ?? []), nested];
        continue;
      }
      items.push({ type: "listItem", content: [paragraph(m[m.length - 1], warnings)] });
      i++;
    }
    return ordered ? { type: "orderedList", content: items } : { type: "bulletList", content: items };
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = FENCE_RE.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      if (i >= lines.length) warnings.push("Unclosed code fence closed at the end of the file");
      i++;
      const code = body.join("\n");
      blocks.push({ type: "codeBlock", attrs: { language: fence[2] || null }, ...(code ? { content: [textNode(code)] } : {}) });
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      if (level > 3) warnings.push(`Heading level ${level} shown as level 3: ${heading[2]}`);
      blocks.push({ type: "heading", attrs: { level: Math.min(level, 3) }, content: parseInline(heading[2], warnings) });
      i++;
      continue;
    }
    if (RULE_RE.test(line)) { flush(); blocks.push({ type: "horizontalRule" }); i++; continue; }
    if (asTasks && CHECK_RE.test(line)) { flush(); readChecklist(); continue; }
    if (BULLET_RE.test(line) || ORDERED_RE.test(line)) { flush(); blocks.push(readList()); continue; }
    if (line.trimStart().startsWith(">")) {
      flush();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) quoted.push(lines[i++].trimStart().replace(/^>\s?/, ""));
      blocks.push({ type: "blockquote", content: [paragraph(quoted.join(" "), warnings)] });
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      flush();
      warnings.push("Table kept as plain text lines");
      while (i < lines.length && lines[i].trimStart().startsWith("|")) blocks.push({ type: "paragraph", content: [textNode(lines[i++].trim())] });
      continue;
    }
    if (/^\s*<[A-Za-z!/]/.test(line)) {
      flush();
      warnings.push(`HTML kept as plain text: ${line.trim().slice(0, 60)}`);
      blocks.push({ type: "paragraph", content: [textNode(line.trim())] });
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return { blocks, tasks, warnings };
}
