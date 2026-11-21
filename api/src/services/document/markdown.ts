import type { DocumentMark, DocumentNode } from "../../contracts/document.js";

/** What a task reference renders as: its title and completion, read from the canonical task. */
export interface ReferencedTask {
  title: string;
  isCompleted: boolean;
}

function inline(nodes: DocumentNode[] = []): string {
  return nodes.map((node) => {
    if (node.type === "hardBreak") return "  \n";
    let text = node.text ?? "";
    for (const mark of node.marks ?? ([] as DocumentMark[])) {
      if (mark.type === "bold") text = `**${text}**`;
      else if (mark.type === "italic") text = `*${text}*`;
      else if (mark.type === "strike") text = `~~${text}~~`;
      else if (mark.type === "code") text = `\`${text}\``;
      else if (mark.type === "link") text = `[${text}](${String(mark.attrs?.href ?? "")})`;
    }
    return text;
  }).join("");
}

function block(node: DocumentNode, tasks: ReadonlyMap<string, ReferencedTask>, indent = ""): string {
  switch (node.type) {
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case "paragraph":
      return indent + inline(node.content);
    case "blockquote":
      return (node.content ?? []).map((child) => block(child, tasks)).join("\n\n").split("\n").map((line) => `> ${line}`.trimEnd()).join("\n");
    case "codeBlock":
      return `\`\`\`${String(node.attrs?.language ?? "")}\n${inline(node.content)}\n\`\`\``;
    case "horizontalRule":
      return "---";
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).map((item, index) => {
        const marker = node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}.` : "-";
        const [first, ...rest] = item.content ?? [];
        const head = `${indent}${marker} ${first ? inline(first.content) : ""}`;
        const tail = rest.map((child) => block(child, tasks, `${indent}  `));
        return [head, ...tail].join("\n");
      }).join("\n");
    case "taskReference": {
      const task = tasks.get(String(node.attrs?.taskId));
      return task ? `- [${task.isCompleted ? "x" : " "}] ${task.title}` : "- [ ] (task no longer available)";
    }
    default:
      return inline(node.content);
  }
}

/** Readable Markdown for exports. Consecutive task references read as one checklist. */
export function documentToMarkdown(doc: DocumentNode, tasks: ReadonlyMap<string, ReferencedTask> = new Map()): string {
  const blocks = doc.content ?? [];
  let out = "";
  blocks.forEach((node, index) => {
    const tight = index > 0 && node.type === "taskReference" && blocks[index - 1].type === "taskReference";
    if (index > 0) out += tight ? "\n" : "\n\n";
    out += block(node, tasks);
  });
  return out ? `${out}\n` : "";
}
