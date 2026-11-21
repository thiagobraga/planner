import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdownParse.js";

const text = (value: string) => ({ type: "text", text: value });

describe("parseMarkdown", () => {
  it("keeps headings, paragraphs, code, quotes, rules and inline marks as document blocks", () => {
    const { blocks, warnings } = parseMarkdown([
      "# Goal",
      "Plain **bold** and *soft* with `code` and [a link](https://example.com).",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "> quoted",
      "---",
    ].join("\n"));

    expect(warnings).toEqual([]);
    expect(blocks[0]).toEqual({ type: "heading", attrs: { level: 1 }, content: [text("Goal")] });
    expect(blocks[1].content).toEqual([
      text("Plain "),
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      text(" and "),
      { type: "text", text: "soft", marks: [{ type: "italic" }] },
      text(" with "),
      { type: "text", text: "code", marks: [{ type: "code" }] },
      text(" and "),
      { type: "text", text: "a link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
      text("."),
    ]);
    expect(blocks[2]).toEqual({ type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;")] });
    expect(blocks[3]).toEqual({ type: "blockquote", content: [{ type: "paragraph", content: [text("quoted")] }] });
    expect(blocks[4]).toEqual({ type: "horizontalRule" });
  });

  it("turns checklist items into nested tasks placed where the list was, with done and in-progress states", () => {
    const { blocks, tasks } = parseMarkdown([
      "Intro",
      "- [x] Done step",
      "- [ ] Parent step",
      "  - [~] Child in progress",
      "- plain bullet",
      "Outro",
    ].join("\n"));

    expect(tasks.map((task) => [task.title, task.state, task.children.map((c) => [c.title, c.state])])).toEqual([
      ["Done step", "done", []],
      ["Parent step", "open", [["Child in progress", "doing"]]],
    ]);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "taskReference", "taskReference", "bulletList", "paragraph"]);
    expect(blocks[1].attrs).toEqual({ key: tasks[0].key });
  });

  it("keeps checklists as prose when asked", () => {
    const { blocks, tasks } = parseMarkdown("- [x] Keep me as text", { checklists: "text" });
    expect(tasks).toEqual([]);
    expect(blocks[0].type).toBe("bulletList");
  });

  it("warns instead of dropping tables, html, images, deep headings and unsafe links", () => {
    const { blocks, warnings } = parseMarkdown([
      "#### Deep",
      "| a | b |",
      "<div>raw</div>",
      "![img](x.png)",
      "[bad](javascript:alert(1))",
    ].join("\n"));

    expect(blocks[0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
    expect(JSON.stringify(blocks)).toContain("| a | b |");
    expect(JSON.stringify(blocks)).toContain("<div>raw</div>");
    expect(JSON.stringify(blocks)).not.toContain("javascript:");
    expect(warnings).toHaveLength(5);
  });

  it("flags nesting past the depth limit and keeps the extra levels as plain titles", () => {
    const lines = ["- [ ] L1", "  - [ ] L2", "    - [ ] L3"];
    const { tasks, warnings } = parseMarkdown(lines.join("\n"), { maxDepth: 2 });
    expect(tasks[0].children[0].children).toEqual([]);
    expect(tasks[0].children[0].title).toBe("L2");
    expect(warnings.some((w) => w.includes("L3"))).toBe(true);
  });

  it("warns about text that looks like a credential", () => {
    const { warnings } = parseMarkdown("token plnr_abcdefghijklmnopqrstuvwx and ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(warnings.filter((w) => w.startsWith("Possible secret"))).toHaveLength(1);
  });
});
