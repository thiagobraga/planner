import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { documentToPlainText, referencedTaskIds, seedDocument } from "../plainText.js";
import { validateDocument } from "../validate.js";

const REF = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const text = (value: string) => ({ type: "text", text: value });
const para = (...content: object[]) => ({ type: "paragraph", content });
const item = (...content: object[]) => ({ type: "listItem", content });
const doc = (...content: object[]) => validateDocument({ type: "doc", content });

describe("seedDocument", () => {
  it("splits paragraphs on blank lines and keeps single newlines as hard breaks", () => {
    expect(seedDocument("First line\nsecond line\n\nNext paragraph")).toEqual({
      type: "doc",
      content: [
        para(text("First line"), { type: "hardBreak" }, text("second line")),
        para(text("Next paragraph")),
      ],
    });
  });

  it("seeds an empty paragraph for a missing or empty description", () => {
    expect(seedDocument(null)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(seedDocument("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("produces documents the validator accepts", () => {
    fc.assert(fc.property(fc.string({ maxLength: 400 }), (description) => {
      expect(() => validateDocument(seedDocument(description))).not.toThrow();
    }));
  });

  it("round-trips any plain description through the derived text unchanged", () => {
    const lines = fc.stringMatching(/^[a-z \t\r\n.*-]{0,40}$/);
    fc.assert(fc.property(fc.oneof(fc.string({ maxLength: 200 }), lines), (description) => {
      expect(documentToPlainText(seedDocument(description))).toBe(description);
    }), { numRuns: 500 });
    for (const edge of ["\n", "\n\n", "\n\n\n", "a\n\n\nb", "a\n\n\n\nb", "\n\na\n\n", " spaced ", "a\r\nb"]) {
      expect(documentToPlainText(seedDocument(edge))).toBe(edge);
    }
  });
});

describe("documentToPlainText", () => {
  it("renders headings and paragraphs as lines, lists as '- ' items with nesting", () => {
    const content = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Plan")] },
      para(text("Intro "), { type: "text", text: "bold", marks: [{ type: "bold" }] }),
      {
        type: "bulletList",
        content: [
          item(para(text("one")), { type: "bulletList", content: [item(para(text("nested")))] }),
          item(para(text("two")), para(text("more about two"))),
        ],
      },
      { type: "orderedList", attrs: { start: 1 }, content: [item(para(text("first")))] },
    );
    expect(documentToPlainText(content)).toBe(
      "Plan\n\nIntro bold\n\n- one\n  - nested\n- two\n  more about two\n\n- first",
    );
  });

  it("quotes blockquotes, keeps code verbatim and draws rules", () => {
    const content = doc(
      { type: "blockquote", content: [para(text("said"), { type: "hardBreak" }, text("twice"))] },
      { type: "codeBlock", attrs: { language: "sh" }, content: [text("ls -la\n  cd /")] },
      { type: "horizontalRule" },
    );
    expect(documentToPlainText(content)).toBe("> said\n> twice\n\nls -la\n  cd /\n\n---");
  });

  it("renders a task reference as its title when known and omits it otherwise", () => {
    const content = doc(para(text("Before")), { type: "taskReference", attrs: { taskId: REF, blockId: "b1" } }, para(text("After")));
    expect(documentToPlainText(content, new Map([[REF, "Write tests"]]))).toBe("Before\n\nWrite tests\n\nAfter");
    expect(documentToPlainText(content)).toBe("Before\n\nAfter");
  });

  it("indents multiline list item heads, renders empty code blocks, and omits unresolved task references inside list items", () => {
    const content = doc(
      {
        type: "bulletList",
        content: [
          item(
            para(text("line 1"), { type: "hardBreak" }, text("line 2")),
            { type: "taskReference", attrs: { taskId: REF, blockId: "b1" } },
          ),
        ],
      },
      { type: "codeBlock", attrs: { language: null } },
    );
    expect(documentToPlainText(content)).toBe("- line 1\n  line 2\n\n");
    expect(documentToPlainText(content, new Map([[REF, "Linked step"]]))).toBe("- line 1\n  line 2\n  Linked step\n\n");
  });
});

describe("referencedTaskIds", () => {
  it("collects task ids from references at any depth, once each", () => {
    const ref = { type: "taskReference", attrs: { taskId: REF, blockId: "b1" } };
    const content = doc(ref, { type: "blockquote", content: [{ ...ref, attrs: { taskId: REF, blockId: "b2" } }] });
    expect(referencedTaskIds(content)).toEqual([REF]);
    expect(referencedTaskIds(doc(para(text("none"))))).toEqual([]);
  });
});
