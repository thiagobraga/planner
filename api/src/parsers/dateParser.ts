import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import peggy from 'peggy';

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  weekdays?: number[];
  dayOfMonth?: number;
  month?: number;
}

export interface DueDate {
  date: string;
  time?: string;
  timezone?: string;
  recurrence?: RecurrenceRule;
}

interface ParserOptions {
  now?: Date;
}

type PeggyParser = { parse: (input: string, options?: Record<string, unknown>) => unknown };

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
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error(`Unrecognized date expression: "${input}"`);
  }

  try {
    const result = parser.parse(trimmed, { now: options?.now }) as DueDate;
    return result;
  } catch (e: unknown) {
    const pegError = e as { location?: { start?: { offset?: number } }; message?: string };
    if (pegError.location?.start?.offset !== undefined) {
      const unrecognized = trimmed.slice(pegError.location.start.offset);
      throw new Error(`Unrecognized date expression: "${unrecognized}"`);
    }
    throw new Error(`Unrecognized date expression: "${trimmed}"`);
  }
}
