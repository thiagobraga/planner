import { AppError } from "../../utils/AppError.js";
import type { DocumentNode, DocumentPutRequest } from "../../contracts/document.js";
import type { DocumentAttrSpec, DocumentContentKind, DocumentNodeGroup } from "../../types/document.js";
import { MARK_SPECS, NODE_SPECS } from "./schema.js";

export const MAX_DOCUMENT_BYTES = 256 * 1024;
export const MAX_DOCUMENT_DEPTH = 20;
export const MAX_DOCUMENT_NODES = 8000;

const NODE_KEYS = new Set(["type", "attrs", "content", "text", "marks"]);
const MARK_KEYS = new Set(["type", "attrs"]);
const ACCEPTS: Record<Exclude<DocumentContentKind, "none">, DocumentNodeGroup> = {
  block: "block",
  inline: "inline",
  listItem: "listItem",
  plainText: "inline",
};

function fail(path: string, message: string, field = "content"): never {
  throw new AppError({
    code: "VALIDATION_ERROR",
    message: "Document failed validation",
    statusCode: 400,
    details: [{ field, path, message }],
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkAttrs(attrs: unknown, specs: Record<string, DocumentAttrSpec>, path: string): void {
  if (attrs === undefined) {
    const missing = Object.keys(specs).find((key) => specs[key]!.required);
    if (missing) fail(`${path}.attrs.${missing}`, "is required");
    return;
  }
  if (!isObject(attrs)) fail(`${path}.attrs`, "must be an object");
  for (const key of Object.keys(attrs)) {
    if (!Object.hasOwn(specs, key)) fail(`${path}.attrs.${key}`, `unknown attribute "${key}"`);
  }
  for (const [key, spec] of Object.entries(specs)) {
    const present = Object.hasOwn(attrs, key) && attrs[key] !== undefined;
    if (!present) {
      if (spec.required) fail(`${path}.attrs.${key}`, "is required");
      continue;
    }
    if (!spec.valid(attrs[key])) fail(`${path}.attrs.${key}`, spec.message);
  }
}

function checkMarks(marks: unknown, path: string): void {
  if (!Array.isArray(marks)) fail(`${path}.marks`, "must be a list");
  const seen = new Set<string>();
  marks.forEach((mark: unknown, i) => {
    const markPath = `${path}.marks[${i}]`;
    if (!isObject(mark) || typeof mark.type !== "string") fail(markPath, "must be a mark object");
    const specs = Object.hasOwn(MARK_SPECS, mark.type) ? MARK_SPECS[mark.type] : undefined;
    if (!specs) fail(markPath, `unknown mark "${mark.type}"`);
    for (const key of Object.keys(mark)) {
      if (!MARK_KEYS.has(key)) fail(markPath, `unknown key "${key}"`);
    }
    if (seen.has(mark.type)) fail(markPath, `mark "${mark.type}" appears twice`);
    seen.add(mark.type);
    checkAttrs(mark.attrs, specs, markPath);
  });
}

interface Walk {
  nodes: number;
}

function checkNode(node: unknown, path: string, depth: number, parent: DocumentContentKind | "root", walk: Walk): void {
  if (depth > MAX_DOCUMENT_DEPTH) fail(path, `document is nested too deep (max ${MAX_DOCUMENT_DEPTH} levels)`);
  walk.nodes += 1;
  if (walk.nodes > MAX_DOCUMENT_NODES) fail(path, `document has too many nodes (max ${MAX_DOCUMENT_NODES})`);
  if (!isObject(node) || typeof node.type !== "string") fail(path, "must be a node object with a type");

  const spec = Object.hasOwn(NODE_SPECS, node.type) ? NODE_SPECS[node.type] : undefined;
  if (!spec) fail(path, `unknown node type "${node.type}"`);
  if (parent === "root" ? spec.group !== "doc" : spec.group !== ACCEPTS[parent as keyof typeof ACCEPTS]) {
    fail(path, parent === "root" ? "the root must be a doc node" : `"${node.type}" is not allowed here`);
  }
  if (parent === "plainText" && node.type !== "text") fail(path, "code blocks hold plain text only");
  for (const key of Object.keys(node)) {
    if (!NODE_KEYS.has(key)) fail(path, `unknown key "${key}"`);
  }

  checkAttrs(node.attrs, spec.attrs, path);

  if (node.marks !== undefined) {
    if (spec.group !== "inline" || parent === "plainText") fail(`${path}.marks`, "marks are not allowed here");
    checkMarks(node.marks, path);
  }

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) fail(`${path}.text`, "must be non-empty text");
    if (node.text.includes("\u0000")) fail(`${path}.text`, "must not contain NUL characters");
    if (node.text.includes("\0")) fail(`${path}.text`, "must not contain NUL");
  } else if (node.text !== undefined) {
    fail(`${path}.text`, "only text nodes carry text");
  }

  if (node.content === undefined) {
    if (spec.nonEmpty) fail(`${path}.content`, "needs content");
    return;
  }
  if (spec.content === "none") fail(`${path}.content`, `"${node.type}" takes no content`);
  if (!Array.isArray(node.content)) fail(`${path}.content`, "must be a list");
  if (spec.nonEmpty && node.content.length === 0) fail(`${path}.content`, "needs content");
  if (spec.firstChild && (node.content[0] as { type?: unknown })?.type !== spec.firstChild) {
    fail(`${path}.content[0]`, `must be a ${spec.firstChild}`);
  }
  node.content.forEach((child: unknown, i) => {
    checkNode(child, `${path}.content[${i}]`, depth + 1, spec.content, walk);
  });
}

/**
 * Accept a Tiptap/ProseMirror JSON document only if every node, mark and
 * attribute is on the allowlist and it stays within the size, depth and node
 * bounds. Throws a 400 VALIDATION_ERROR naming the first offending path.
 */
export function validateDocument(content: unknown): DocumentNode {
  let serialized: string;
  try {
    serialized = JSON.stringify(content);
  } catch {
    fail("content", "must be plain JSON");
  }
  if (!isObject(content)) fail("content", "must be a doc node object");
  checkNode(content, "content", 0, "root", { nodes: 0 });
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > MAX_DOCUMENT_BYTES) fail("content", `document is ${bytes} bytes (max ${MAX_DOCUMENT_BYTES})`);
  return content as unknown as DocumentNode;
}

/** Parse a PUT body: a valid document plus the revision it was edited from. */
export function parseDocumentPut(body: unknown): DocumentPutRequest {
  if (!isObject(body)) fail("body", "must be an object with content and baseRevision", "body");
  for (const key of Object.keys(body)) {
    if (key !== "content" && key !== "baseRevision") fail(key, `unknown field "${key}"`, key);
  }
  const { baseRevision } = body;
  if (typeof baseRevision !== "number" || !Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    fail("baseRevision", "must be the whole-number revision the edit started from (0 before the first save)", "baseRevision");
  }
  return { content: validateDocument(body.content), baseRevision };
}
