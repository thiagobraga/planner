import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import peggy from 'peggy';
import type { DueDate } from '../types/recurrence.js';
import type { ParserOptions, PeggyParser } from '../types/parsers.js';

// Accents are optional in Portuguese input ("amanhã" or "amanha"), so the grammar only knows the bare letters.
function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

let cachedParser: PeggyParser | null = null;

function getParser(): PeggyParser {
  if (cachedParser) return cachedParser;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const grammarPath = join(__dirname, 'date.peggy');
  const grammar = readFileSync(grammarPath, 'utf-8');

  const parser = peggy.generate(grammar);
  cachedParser = parser as unknown as PeggyParser;
  return cachedParser;
}

export function parseDueDate(input: string, options?: ParserOptions): DueDate {
  const parser = getParser();
  const trimmed = stripAccents(input.trim());

  if (!trimmed) {
    throw new Error(`Unrecognized date expression: "${input}"`);
  }

  try {
    const result = parser.parse(trimmed, { now: options?.now, locale: options?.locale }) as DueDate;
    return result;
  } catch (e: unknown) {
    const pegError = e as { location?: { start?: { offset?: number } }; message?: string };
    if (pegError.location?.start?.offset !== undefined) {
      const unrecognized = trimmed.slice(pegError.location.start.offset);
      throw new Error(`Unrecognized date expression: "${unrecognized}"`, { cause: e });
    }
    throw new Error(`Unrecognized date expression: "${trimmed}"`, { cause: e });
  }
}
