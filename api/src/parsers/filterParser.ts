import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import peggy from 'peggy';

export type FilterExpr =
  | { type: 'and'; left: FilterExpr; right: FilterExpr }
  | { type: 'or'; left: FilterExpr; right: FilterExpr }
  | { type: 'not'; expr: FilterExpr }
  | { type: 'project'; name: string }
  | { type: 'label'; name: string }
  | { type: 'priority'; level: 1 | 2 | 3 | 4 }
  | { type: 'today' }
  | { type: 'overdue' }
  | { type: 'noDate' }
  | { type: 'dueOn'; date: string }
  | { type: 'dueBefore'; date: string }
  | { type: 'dueAfter'; date: string }
  | { type: 'assignedTo'; user: string }
  | { type: 'text'; value: string };

export interface FilterParseError extends Error {
  position: number;
}

type PeggyParser = { parse: (input: string) => unknown };

let cachedParser: PeggyParser | null = null;

function getParser(): PeggyParser {
  if (cachedParser) return cachedParser;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const grammarPath = join(__dirname, 'filter.peggy');
  const grammar = readFileSync(grammarPath, 'utf-8');

  const parser = peggy.generate(grammar);
  cachedParser = parser as unknown as PeggyParser;
  return cachedParser;
}

export function parseFilter(input: string): FilterExpr {
  const parser = getParser();
  const trimmed = input.trim();

  if (!trimmed) {
    const err = new Error('Empty filter query') as FilterParseError;
    err.position = 0;
    throw err;
  }

  try {
    return parser.parse(trimmed) as FilterExpr;
  } catch (e: unknown) {
    const pegError = e as { location?: { start?: { offset?: number } }; message?: string };
    const offset = pegError.location?.start?.offset ?? 0;
    const err = new Error(`Filter parse error at position ${offset}: ${pegError.message ?? 'unexpected token'}`) as FilterParseError;
    err.position = offset;
    throw err;
  }
}
