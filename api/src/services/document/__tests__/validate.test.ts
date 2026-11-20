import { describe, expect, it } from "vitest";
import { parseDocumentPut, validateDocument, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_DEPTH, MAX_DOCUMENT_NODES } from "../validate.js";
import { AppError } from "../../../utils/AppError.js";

const TASK_ID = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

const text = (value: string, marks?: unknown[]) => (marks ? { type: "text", text: value, marks } : { type: "text", text: value });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

function rejection(content: unknown): { message: string; path: string } {
  try {
    validateDocument(content);
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    const error = err as AppError;
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    const [detail] = error.details as { field: string; path: string; message: string }[];
    expect(detail.field).toBe("content");
    return detail;
  }
  throw new Error("expected the document to be rejected");
}

function nested(depth: number): unknown {
  let node: unknown = para(text("deep"));
  for (let i = 0; i < depth; i++) node = { type: "blockquote", content: [node] };
  return doc(node);
}

describe("validateDocument accepts", () => {
  it("everything the StarterKit set produces", () => {
    const content = doc(
      { type: "heading", attrs: { level: 1 }, content: [text("Plan")] },
      { type: "heading", attrs: { level: 3 }, content: [text("Detail")] },
      para(
        text("bold", [{ type: "bold" }]),
        text("italic", [{ type: "italic" }, { type: "strike" }]),
        { type: "hardBreak" },
        text("code", [{ type: "code" }]),
        text("site", [{ type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow", class: null } }]),
        text("mail", [{ type: "link", attrs: { href: "mailto:a@example.com" } }]),
      ),
      { type: "bulletList", content: [{ type: "listItem", content: [para(text("one")), { type: "orderedList", attrs: { start: 3, type: null }, content: [{ type: "listItem", content: [para(text("nested"))] }] }] }] },
      { type: "blockquote", content: [para(text("quote"))] },
      { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;")] },
      { type: "codeBlock", attrs: { language: null } },
      { type: "horizontalRule" },
      para(),
      { type: "taskReference", attrs: { taskId: TASK_ID, blockId: "blk_01-a" } },
    );
    expect(validateDocument(content)).toEqual(content);
  });

  it("an empty document", () => {
    expect(validateDocument(doc())).toEqual(doc());
  });

  it("depth and node counts right at the limits", () => {
    expect(() => validateDocument(nested(MAX_DOCUMENT_DEPTH - 2))).not.toThrow();
    // doc + paragraph + breaks
    const breaks = Array.from({ length: MAX_DOCUMENT_NODES - 2 }, () => ({ type: "hardBreak" }));
    expect(() => validateDocument(doc(para(...breaks)))).not.toThrow();
  });
});

describe("validateDocument rejects", () => {
  it("a root that is not a doc, or not an object", () => {
    expect(rejection(para(text("x"))).message).toMatch(/doc/);
    expect(rejection("doc").path).toBe("content");
    expect(rejection(null).path).toBe("content");
    expect(rejection([doc()]).path).toBe("content");
  });

  it("unknown node and mark types", () => {
    expect(rejection(doc({ type: "image", attrs: { src: "https://x" } }))).toMatchObject({ path: "content.content[0]" });
    expect(rejection(doc(para(text("x", [{ type: "underline" }])))).path).toBe("content.content[0].content[0].marks[0]");
  });

  it("unknown keys and attrs", () => {
    expect(rejection(doc({ ...para(text("x")), attrs: { textAlign: "left" } })).message).toMatch(/textAlign/);
    expect(rejection(doc({ ...para(text("x")), onclick: "x" })).message).toMatch(/onclick/);
    expect(rejection(doc({ type: "taskReference", attrs: { taskId: TASK_ID, blockId: "b1", title: "copy" } })).message).toMatch(/title/);
    expect(rejection(doc(para(text("x", [{ type: "bold", attrs: { color: "red" } }])))).message).toMatch(/color/);
  });

  it("bad attr values", () => {
    expect(rejection(doc({ type: "heading", attrs: { level: 4 }, content: [text("h")] })).path).toBe("content.content[0].attrs.level");
    expect(rejection(doc({ type: "heading", content: [text("h")] })).path).toBe("content.content[0].attrs.level");
    expect(rejection(doc({ type: "taskReference", attrs: { taskId: "not-a-uuid", blockId: "b1" } })).path).toBe("content.content[0].attrs.taskId");
    expect(rejection(doc({ type: "taskReference", attrs: { taskId: TASK_ID, blockId: "<b>" } })).path).toBe("content.content[0].attrs.blockId");
    expect(rejection(doc({ type: "taskReference", attrs: { taskId: TASK_ID } })).path).toBe("content.content[0].attrs.blockId");
    expect(rejection(doc({ type: "codeBlock", attrs: { language: "x\" onload=\"y" } })).path).toBe("content.content[0].attrs.language");
    expect(rejection(doc({ type: "orderedList", attrs: { start: -1 }, content: [{ type: "listItem", content: [para()] }] })).path).toBe("content.content[0].attrs.start");
  });

  it("links that are not http, https or mailto", () => {
    const link = (href: unknown) => doc(para(text("x", [{ type: "link", attrs: { href } }])));
    for (const href of ["javascript:alert(1)", " JavaScript:alert(1)", "java\nscript:alert(1)", "data:text/html,<b>", "vbscript:x", "/relative", "//evil.example", "", 42]) {
      expect(rejection(link(href)).path).toBe("content.content[0].content[0].marks[0].attrs.href");
    }
    expect(rejection(doc(para(text("x", [{ type: "link", attrs: {} }])))).path).toBe("content.content[0].content[0].marks[0].attrs.href");
    expect(rejection(doc(para(text("x", [{ type: "link", attrs: { href: "https://a.b", target: "_top" } }])))).path).toBe("content.content[0].content[0].marks[0].attrs.target");
  });

  it("content in the wrong place", () => {
    expect(rejection(doc(text("loose"))).path).toBe("content.content[0]");
    expect(rejection(doc(para(para(text("x"))))).path).toBe("content.content[0].content[0]");
    expect(rejection(doc({ type: "bulletList", content: [para(text("x"))] })).path).toBe("content.content[0].content[0]");
    expect(rejection(doc({ type: "codeBlock", content: [{ type: "hardBreak" }] })).path).toBe("content.content[0].content[0]");
    expect(rejection(doc({ type: "codeBlock", content: [text("x", [{ type: "bold" }])] })).path).toBe("content.content[0].content[0].marks");
    expect(rejection(doc({ type: "horizontalRule", content: [] })).message).toMatch(/content/);
    expect(rejection(doc({ type: "bulletList", content: [] })).path).toBe("content.content[0].content");
  });

  it("malformed text nodes", () => {
    expect(rejection(doc(para(text("")))).path).toBe("content.content[0].content[0].text");
    expect(rejection(doc(para({ type: "text" }))).path).toBe("content.content[0].content[0].text");
    // PostgreSQL text and jsonb cannot store NUL; refuse it here instead of failing on write.
    expect(rejection(doc(para(text("a\u0000b")))).message).toMatch(/NUL/);
    expect(rejection(doc(para({ type: "text", text: "x", content: [] }))).message).toMatch(/content/);
    expect(rejection(doc(para(text("x", [{ type: "bold" }, { type: "bold" }])))).message).toMatch(/twice/);
  });

  it("documents over the size, depth or node limits", () => {
    expect(rejection(doc(para(text("x".repeat(MAX_DOCUMENT_BYTES))))).message).toMatch(/bytes/);
    expect(rejection(nested(MAX_DOCUMENT_DEPTH)).message).toMatch(/deep/);
    const breaks = Array.from({ length: MAX_DOCUMENT_NODES - 1 }, () => ({ type: "hardBreak" }));
    expect(rejection(doc(para(...breaks))).message).toMatch(/nodes/);
  });

  it("values JSON cannot carry", () => {
    const cyclic: Record<string, unknown> = { type: "doc", content: [] };
    (cyclic.content as unknown[]).push(cyclic);
    expect(rejection(cyclic).path).toBe("content");
  });

  it("prototype property names, non-plain objects, and structural edge cases", () => {
    for (const protoKey of ["toString", "constructor", "valueOf"]) {
      expect(rejection(doc({ type: protoKey })).path).toBe("content.content[0]");
      expect(rejection(doc(para(text("x", [{ type: protoKey }])))).path).toBe("content.content[0].content[0].marks[0]");
      expect(rejection(doc({ type: "heading", attrs: { level: 1, [protoKey]: "x" }, content: [text("h")] })).path)
        .toBe(`content.content[0].attrs.${protoKey}`);
    }
    expect(rejection(new Date()).path).toBe("content");
    expect(rejection(doc({ type: "heading", attrs: new Date(), content: [text("h")] })).path).toBe("content.content[0].attrs");
    expect(rejection(doc({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "bulletList", content: [{ type: "listItem", content: [para(text("x"))] }] }] }] })).path)
      .toBe("content.content[0].content[0].content[0]");
    expect(rejection(doc({ ...para(text("x")), marks: [{ type: "bold" }] })).path).toBe("content.content[0].marks");
    expect(rejection(doc(para(text("x", [{ type: "bold", extra: 1 }])))).path).toBe("content.content[0].content[0].marks[0]");
    expect(rejection(doc({ ...para(), text: "x" })).path).toBe("content.content[0].text");
  });
});

describe("parseDocumentPut", () => {
  it("rejects non-plain bodies and unknown top-level fields", () => {
    expect(() => parseDocumentPut(new Date())).toThrowError(AppError);
    expect(() => parseDocumentPut({ content: doc(), baseRevision: 0, extra: true })).toThrowError(AppError);
    expect(parseDocumentPut({ content: doc(para(text("ok"))), baseRevision: 0 })).toEqual({
      content: doc(para(text("ok"))),
      baseRevision: 0,
    });
  });
});
