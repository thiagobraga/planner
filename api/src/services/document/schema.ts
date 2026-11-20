import type { DocumentAttrSpec, DocumentNodeSpec } from "../../types/document.js";

// The Tiptap StarterKit subset plus the reserved taskReference block. Anything
// outside this list is rejected rather than stored and rendered later.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOCK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const LANGUAGE_RE = /^[A-Za-z0-9_+#.-]{1,32}$/;
const REL_RE = /^[a-z ]{0,64}$/;
const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const MAX_HREF_LENGTH = 2048;

// Control characters and surrounding whitespace are rejected outright: URL
// parsers strip some of them, which is how "java\nscript:" slips past naive checks.
export function isSafeHref(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_HREF_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value) || value.trim() !== value) return false;
  try {
    return LINK_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

const attr = (required: boolean, valid: (v: unknown) => boolean, message: string): DocumentAttrSpec => ({ required, valid, message });

export const NODE_SPECS: Record<string, DocumentNodeSpec> = {
  doc: { group: "doc", content: "block", attrs: {} },
  paragraph: { group: "block", content: "inline", attrs: {} },
  heading: {
    group: "block",
    content: "inline",
    attrs: { level: attr(true, (v) => v === 1 || v === 2 || v === 3, "must be 1, 2 or 3") },
  },
  bulletList: { group: "block", content: "listItem", nonEmpty: true, attrs: {} },
  orderedList: {
    group: "block",
    content: "listItem",
    nonEmpty: true,
    attrs: {
      start: attr(false, (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1_000_000, "must be a whole number from 0 to 1000000"),
      type: attr(false, (v) => v === null || v === "1" || v === "a" || v === "A" || v === "i" || v === "I", "must be one of 1, a, A, i, I"),
    },
  },
  listItem: { group: "listItem", content: "block", nonEmpty: true, firstChild: "paragraph", attrs: {} },
  blockquote: { group: "block", content: "block", nonEmpty: true, attrs: {} },
  codeBlock: {
    group: "block",
    content: "plainText",
    attrs: { language: attr(false, (v) => v === null || (typeof v === "string" && LANGUAGE_RE.test(v)), "must be a short language name") },
  },
  horizontalRule: { group: "block", content: "none", attrs: {} },
  taskReference: {
    group: "block",
    content: "none",
    attrs: {
      taskId: attr(true, (v) => typeof v === "string" && UUID_RE.test(v), "must be a task id"),
      blockId: attr(true, (v) => typeof v === "string" && BLOCK_ID_RE.test(v), "must be 1-64 letters, digits, _ or -"),
    },
  },
  text: { group: "inline", content: "none", attrs: {} },
  hardBreak: { group: "inline", content: "none", attrs: {} },
};

export const MARK_SPECS: Record<string, Record<string, DocumentAttrSpec>> = {
  bold: {},
  italic: {},
  strike: {},
  code: {},
  link: {
    href: attr(true, isSafeHref, "must be an http, https or mailto URL"),
    target: attr(false, (v) => v === null || v === "_blank", "must be _blank or null"),
    rel: attr(false, (v) => v === null || (typeof v === "string" && REL_RE.test(v)), "must be a short rel list"),
    class: attr(false, (v) => v === null, "must be null"),
  },
};
