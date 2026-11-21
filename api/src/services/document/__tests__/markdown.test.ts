import { describe, expect, it } from "vitest";
import { documentToMarkdown } from "../markdown.js";
import type { DocumentMark } from "../../../contracts/document.js";

const t = (text: string, marks?: DocumentMark[]) => (marks ? { type: "text", text, marks } : { type: "text", text });
const p = (...content: ReturnType<typeof t>[]) => ({ type: "paragraph", content });

describe("documentToMarkdown", () => {
  it("renders marks, lists, code, quotes, rules and task blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [t("Plan")] },
        p(t("a "), t("link", [{ type: "link", attrs: { href: "https://x.dev" } }]), t(" and "), t("code", [{ type: "code" }])),
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("one")), { type: "orderedList", content: [{ type: "listItem", content: [p(t("nested"))] }] }] }] },
        { type: "codeBlock", attrs: { language: "ts" }, content: [t("const a = 1;")] },
        { type: "blockquote", content: [p(t("quoted"))] },
        { type: "horizontalRule" },
        { type: "taskReference", attrs: { taskId: "a", blockId: "1" } },
        { type: "taskReference", attrs: { taskId: "b", blockId: "2" } },
        { type: "taskReference", attrs: { taskId: "gone", blockId: "3" } },
      ],
    };
    const tasks = new Map([["a", { title: "Done", isCompleted: true }], ["b", { title: "Open", isCompleted: false }]]);
    expect(documentToMarkdown(doc, tasks)).toBe([
      "# Plan",
      "",
      "a [link](https://x.dev) and `code`",
      "",
      "- one\n  1. nested",
      "",
      "```ts\nconst a = 1;\n```",
      "",
      "> quoted",
      "",
      "---",
      "",
      "- [x] Done\n- [ ] Open\n- [ ] (task no longer available)",
      "",
    ].join("\n"));
  });

  it("returns an empty string for an empty document", () => {
    expect(documentToMarkdown({ type: "doc", content: [] })).toBe("");
  });
});
