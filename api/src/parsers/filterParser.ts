import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import peggy from 'peggy';
import type { FilterExpr, FilterParseError } from '../types/filters.js';
import type { PeggyParser } from '../types/parsers.js';

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
